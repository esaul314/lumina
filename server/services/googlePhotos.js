const fs = require('fs');
const path = require('path');
const { readEnvVar, persistEnvVars } = require('../config/env.js');
const { applyPoolPolicy } = require('../domain/poolRetention.js');
const {
  buildCachedMediaItem,
  buildGooglePhotoMetadataPatch,
  buildGooglePhotoProxyUrl,
  dedupeMediaItemsById,
  getGooglePhotoMediaItemId,
  getPickerItemMimeType,
  isUsableCachedMediaItem,
  mergeCachedMediaItemMetadata,
  mergeSyncedMediaItems,
  normalizeCachedMediaItem
} = require('./googlePhotosCache.js');

const CACHE_PATH = process.env.LUMINA_GOOGLE_PHOTOS_CACHE_PATH
  || path.join(__dirname, '..', 'config', 'google_photos_cache.json');
const DEFAULT_RENDER_WIDTH = 2560;
const DEFAULT_RENDER_HEIGHT = 1440;
const BASE_URL_TTL_MS = 55 * 60 * 1000;

// Ensure parent directories exist
const configDir = path.dirname(CACHE_PATH);
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

const MEDIA_DIR = path.join(configDir, 'google_photos_media');
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

let credentials = {
  clientId: readEnvVar('GOOGLE_CLIENT_ID'),
  clientSecret: readEnvVar('GOOGLE_CLIENT_SECRET')
};
let tokens = { accessToken: '', refreshToken: readEnvVar('GOOGLE_REFRESH_TOKEN'), expiry: 0 };

/**
 * Persist a normalized refresh token without changing service token state.
 *
 * Uses String(refreshToken || '').trim(): falsy inputs become empty, while
 * truthy inputs retain native string coercion and its possible hook effects.
 * Empty results and case-sensitive MOCK_ prefixes skip persistence. Other
 * results synchronously submit exactly one GOOGLE_REFRESH_TOKEN patch, even
 * for repeated values or in test mode; no token validation occurs here.
 *
 * The persistence adapter's result is ignored, not returned or awaited.
 * Coercion and synchronous persistence failures propagate unchanged without
 * logging, retry, or rollback; adapter effects before failure can survive.
 * Token/credential assignment belongs to callers. No cache, authentication,
 * network, or clock work is performed here.
 *
 * @param {unknown} refreshToken Value to normalize; not a validity guarantee.
 * @returns {void}
 * @throws {unknown} Native coercion or synchronous persistence failure.
 */
function persistGoogleRefreshToken(refreshToken) {
  const normalized = String(refreshToken || '').trim();
  if (!normalized || normalized.startsWith('MOCK_')) {
    return;
  }

  persistEnvVars({
    GOOGLE_REFRESH_TOKEN: normalized
  });
}

/**
 * Project the shared proxy decoder's media id to a boolean.
 *
 * Delegates String(value || '').trim(), exact relative-prefix recognition,
 * query removal, and one percent-decoding pass to getGooglePhotoMediaItemId.
 * Any non-empty decoded id is true, including whitespace or path separators;
 * this is vocabulary recognition, not URL validation or an availability check.
 * Absolute URLs and empty ids are false. No post-decoding trim is applied.
 *
 * This data-first composition performs no service-state reads, authentication,
 * cache, network, clock, persistence, or logging work. Native input coercion
 * hooks can have effects; their failures and malformed-encoding URIErrors
 * propagate unchanged rather than becoming false.
 *
 * @param {unknown} value Input accepted by the shared proxy decoder.
 * @returns {boolean} Whether the decoder returns a non-empty media id.
 * @throws {unknown} Native coercion or delegated URI decoding failure.
 */
function isGooglePhotoProxyUrl(value) {
  return Boolean(getGooglePhotoMediaItemId(value));
}

/**
 * Pure projection of a base URL and render options into a content URL.
 *
 * An empty or absent base URL produces an empty string. Omitted or undefined
 * dimensions default independently to 2560 by 1440; supplied values are
 * interpolated without validation or clamping. Directives are ordered width,
 * height, then optional crop. The base URL is used verbatim, without parsing,
 * encoding, or replacing existing directives, and options remain unchanged.
 *
 * @param {string | null | undefined} baseUrl Google Photos content base URL.
 * @param {GooglePhotoRenderOptions} [renderOptions={}] Dimensions and crop flag.
 * @returns {string} Content URL with render directives, or an empty string.
 */
function buildGooglePhotoContentUrl(baseUrl, { width = DEFAULT_RENDER_WIDTH, height = DEFAULT_RENDER_HEIGHT, crop = false } = {}) {
  if (!baseUrl) {
    return '';
  }

  const directives = [`w${width}`, `h${height}`];
  if (crop) {
    directives.push('c');
  }
  return `${baseUrl}=${directives.join('-')}`;
}

/**
 * Read the cache as unvalidated JSON, without normalization or persistence.
 *
 * Each call checks existence, then synchronously reads UTF-8 and parses anew.
 * Any valid JSON value is returned, including non-array objects, scalars, and
 * null; row validation and normalization belong to the consuming boundary.
 * Missing files return a fresh empty array without reading or warning. Read
 * and parse failures warn with err.message before returning a fresh empty
 * array. This fallback does not repair, overwrite, or delete the cache.
 *
 * The existence check is outside the catch. Its failures propagate unchanged,
 * as do failures in the warning handler (including nullish thrown values whose
 * message cannot be read). No authentication, network, or clock work occurs.
 *
 * @returns {unknown} Parsed JSON, or a fresh empty array on a handled failure.
 * @throws {unknown} Existence-check or warning-handler failure.
 */
function readCachedMediaItemsRaw() {
  if (!fs.existsSync(CACHE_PATH)) {
    return [];
  }

  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch (err) {
    console.warn('Google Photos Service: Failed to read media cache JSON:', err.message);
    return [];
  }
}

/**
 * Serialize the supplied value and synchronously replace the cache file.
 *
 * Uses native JSON.stringify with no replacer and two-space indentation, then
 * writes once as UTF-8 without an added newline. No normalization, validation,
 * deduplication, equality check, or test-mode guard occurs here; callers own
 * those policies. Native getters/toJSON hooks run before the write and may
 * have effects. An undefined serialization result reaches the filesystem,
 * whose real adapter rejects it rather than writing an empty cache.
 *
 * Serialization and filesystem failures propagate unchanged without logging,
 * retry, or rollback. This is a direct write, not an atomic file replacement;
 * a failed write can leave a changed file. No cache read, authentication,
 * network, or clock work occurs. Successful calls return undefined regardless
 * of the filesystem adapter's result.
 *
 * @param {unknown} items Value to serialize; row policy belongs to callers.
 * @returns {void}
 * @throws {unknown} Serialization-hook, JSON encoding, or filesystem failure.
 */
function writeCachedMediaItems(items) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(items, null, 2), 'utf8');
}

/**
 * Upsert one supplied row into a freshly normalized cache, then persist it.
 *
 * Existing rows pass through the shared normalization/filter/dedupe pipeline
 * before item.id is read. Native Map keys are used without trimming, coercion,
 * or proxy decoding: replacement retains its position; a new key appends.
 * The supplied row replaces the whole entry without normalization, metadata
 * merging, retention, or cap enforcement. Callers own those policies.
 *
 * Every successful call writes, even for identical rows or in test mode, and
 * returns the exact supplied reference only after the synchronous write.
 * Outside test mode the reader may first persist changed normalization, so
 * one call can write twice. Input getters and JSON hooks retain native effects.
 * Reader, input-access, serialization, and write failures propagate without an
 * upsert catch, retry, or rollback; an earlier normalization write can survive
 * a later failure. Reader warnings remain its responsibility. Authentication,
 * network, and clock work are not performed here.
 *
 * @template {import('./googlePhotosCache.js').GooglePhotoMediaItem & {id: string}} T
 * @param {T} item Caller-prepared row; runtime inputs are not validated.
 * @returns {T} The original row, not a merged or detached copy.
 * @throws {unknown} Unhandled reader, input-access, serialization, or write failure.
 */
function updateCachedMediaItem(item) {
  const itemsMap = new Map(getCachedMediaItems().map((entry) => [entry.id, entry]));
  itemsMap.set(item.id, item);
  const mergedItems = Array.from(itemsMap.values());
  writeCachedMediaItems(mergedItems);
  return item;
}

/**
 * Apply an allowlisted metadata patch to a cached Google Photos row.
 *
 * The service reads the normalized cache and delegates the immutable merge to
 * `mergeCachedMediaItemMetadata`. It returns the copied matching row, including
 * when its values are unchanged, or `null` when the identifier or patch does
 * not resolve to a row. The full cache is written only when a matched row
 * actually changes and the process is not in test mode; the projected row is
 * returned even when persistence is skipped.
 *
 * @param {unknown} mediaIdentifier A Google media id or Lumina proxy URL.
 * @param {GooglePhotoMetadataPatchInput} [metadata={}]
 * @returns {LiveGooglePhoto | null}
 */
function updateCachedMediaItemMetadata(mediaIdentifier, metadata = {}) {
  const currentItems = getCachedMediaItems();
  const merged = mergeCachedMediaItemMetadata(currentItems, mediaIdentifier, metadata);

  if (!merged.updatedItem) {
    return null;
  }

  if (merged.changed && process.env.NODE_ENV !== 'test') {
    writeCachedMediaItems(merged.items);
  }

  return merged.updatedItem;
}

/** @typedef {Record<string, unknown>} LiveGooglePhoto */

/**
 * Optional dimensions and crop directive for a Google Photos content URL.
 *
 * @typedef {object} GooglePhotoRenderOptions
 * @property {number} [width] Requested content width.
 * @property {number} [height] Requested content height.
 * @property {boolean} [crop] Whether to request the crop directive.
 */

/**
 * Downloaded image bytes and the media type used to serve them.
 *
 * @typedef {object} GooglePhotoMediaBytes
 * @property {Buffer} buffer Image content as a Node.js buffer.
 * @property {string} contentType Response media type or the cached/default hint.
 */

/**
 * Mutable snapshot fields that can contain Google Photos frames.
 *
 * @typedef {Record<string, unknown> & {
 *   photosList?: Array<LiveGooglePhoto | null | undefined>;
 *   activePhoto?: LiveGooglePhoto | null;
 *   activeSecondPhoto?: LiveGooglePhoto | null;
 * }} MutableGooglePhotoState
 */

/**
 * Metadata accepted by the Google Photos update path; unsupported keys are
 * removed by the checked cache projection before the snapshot is changed.
 *
 * @typedef {Partial<Record<'rating' | 'isBroken' | 'cropPercent' | 'cropPositionY' | 'preventPairing' | 'loved' | 'orientation' | 'width' | 'height', unknown>>} GooglePhotoMetadataPatchInput
 */

/**
 * Apply allowlisted metadata to the live snapshot's matching Google Photos.
 *
 * This effect-shell operation replaces `photosList` with a mapped array,
 * shallow-copies matching rows, and preserves unmatched row references. It
 * updates matching active frame objects in place, retaining their identity.
 * It returns the last updated photo in application order, or `null` when the
 * state, identifier, patch, or matching photo is absent. A valid identifier
 * and patch still remap `photosList` when no row matches.
 *
 * @param {MutableGooglePhotoState | null | undefined} state
 * @param {unknown} mediaIdentifier A Google media id or Lumina proxy URL.
 * @param {GooglePhotoMetadataPatchInput} [metadata={}]
 * @returns {LiveGooglePhoto | null}
 */
function applyCachedMediaItemMetadataToState(state, mediaIdentifier, metadata = {}) {
  const mediaItemId = getGooglePhotoMediaItemId(mediaIdentifier) || String(mediaIdentifier || '').trim();
  const metadataPatch = buildGooglePhotoMetadataPatch(metadata);

  if (!state || !mediaItemId || Object.keys(metadataPatch).length === 0) {
    return null;
  }

  let updatedPhoto = null;
  const matchesMediaItem = (photo) => {
    if (!photo) {
      return false;
    }

    const photoId = String(photo.id || getGooglePhotoMediaItemId(photo.url) || '').trim();
    return photoId === mediaItemId;
  };

  if (Array.isArray(state.photosList)) {
    state.photosList = state.photosList.map((photo) => {
      if (!matchesMediaItem(photo)) {
        return photo;
      }

      const nextPhoto = { ...photo, ...metadataPatch };
      updatedPhoto = nextPhoto;
      return nextPhoto;
    });
  }

  ['activePhoto', 'activeSecondPhoto'].forEach((key) => {
    if (matchesMediaItem(state[key])) {
      Object.assign(state[key], metadataPatch);
      updatedPhoto = state[key];
    }
  });

  return updatedPhoto;
}

/**
 * Read the normalized cache and return its first exact-id match, or null.
 *
 * The supplied id is compared with strict equality: no trimming, coercion,
 * proxy-URL decoding, or input guard is applied. Every call reads the cache
 * before searching, even for an absent or malformed id. The shared reader
 * performs structural filtering and first-usable-id deduplication, not
 * retention, broken-photo filtering, or network/file availability checks.
 *
 * The result is a newly normalized row, not a memoized or persisted reference.
 * Normalization can synchronously persist changed serialization outside test
 * mode, including on a miss. Missing files and caught read/parse failures
 * yield null; reader warnings are retained. Valid non-array JSON, normalization,
 * existence-check, and persistence failures propagate without a lookup catch.
 * This remains a service effect shell, not a pure in-memory selector.
 *
 * @param {string} mediaItemId Stable Google Photos id, used verbatim.
 * @returns {(import('./googlePhotosCache.js').GooglePhotoMediaItem & {id: string; url: string}) | null}
 * @throws {unknown} Unhandled cache-reader or persistence failure.
 */
function findCachedMediaItem(mediaItemId) {
  return getCachedMediaItems().find((item) => item.id === mediaItemId) || null;
}

/**
 * Refresh one cached row from its Google Photos Picker session.
 *
 * An explicit session id takes precedence over the cached row's session id.
 * When neither is available, the promise resolves to the current cached row
 * (or `null`) without making a Picker request. Otherwise the service lists the
 * session, requires an exact media-id match, rebuilds the row while retaining
 * existing metadata, and upserts it through the cache persistence shell. A
 * failed Picker request or a session that no longer contains the item rejects
 * the promise.
 *
 * @param {string} mediaItemId Stable Google Photos media-item id.
 * @param {string} [sessionIdOverride] Optional Picker session to query first.
 * @returns {Promise<LiveGooglePhoto | null>} The refreshed/current row, or null when no row exists without a session.
 */
async function refreshCachedMediaItem(mediaItemId, sessionIdOverride) {
  const existing = findCachedMediaItem(mediaItemId);
  const sessionId = sessionIdOverride || existing?.googlePickerSessionId;

  if (!sessionId) {
    return existing;
  }

  const { mediaItems } = await listPickerMediaItems(sessionId);
  const match = (mediaItems || []).find((item) => item.id === mediaItemId);

  if (!match) {
    throw new Error(`Google Photos Service: Media item ${mediaItemId} is no longer present in picker session ${sessionId}.`);
  }

  const refreshed = buildCachedMediaItem(match, sessionId, existing || {});
  return updateCachedMediaItem(refreshed);
}

/**
 * Classify a cached base URL's age using the service clock.
 *
 * An absent row or falsy timestamp is stale without reading the clock.
 * Otherwise, read `Date.now()` once and compare the elapsed milliseconds
 * against the inclusive 55-minute TTL. Future timestamps remain fresh.
 * Subtraction retains JavaScript coercion: numeric strings are accepted;
 * truthy nonnumeric strings yield NaN and therefore classify as fresh.
 * This predicate does not mutate the row or perform cache/network effects,
 * but its clock read means it is not a pure projection.
 *
 * @param {{googleBaseUrlFetchedAt?: number | string | null} | null | undefined} item Cached epoch-millisecond timestamp.
 * @returns {boolean} Whether the timestamp is absent/falsy or at least one TTL old.
 */
function isBaseUrlStale(item) {
  if (!item?.googleBaseUrlFetchedAt) {
    return true;
  }

  return (Date.now() - item.googleBaseUrlFetchedAt) >= BASE_URL_TTL_MS;
}

/**
 * 🔒 saveGoogleCredentials
 * Trim and replace both service credentials, then persist them synchronously.
 *
 * Both trim calls complete before replacement and outside the catch: invalid
 * inputs or throwing trim methods propagate without logging, persistence, or
 * credential replacement. Empty strings are accepted without validation.
 * Native trim-method dispatch is preserved, not a supported non-string API.
 *
 * Persistence observes the replaced credentials. Success logs after persistence
 * and returns true; a caught failure logs its message and returns false without
 * rollback. Null/undefined thrown values or logging failures can still propagate
 * from the error handler. Repeated saves still persist and log every time.
 * Token state is unchanged. Credential replacement, persistence, and logging
 * remain in the service shell; this is not a pure projection.
 *
 * @param {string} clientId Client ID, trimmed without validation.
 * @param {string} clientSecret Client secret, trimmed without validation.
 * @returns {boolean} True on logged success, false on a handled failure.
 * @throws {TypeError} Invalid trim inputs or nullish caught failures.
 * @throws {Error} Custom trim or logging failures propagate synchronously.
 */
function saveGoogleCredentials(clientId, clientSecret) {
  credentials = { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
  try {
    persistEnvVars({
      GOOGLE_CLIENT_ID: credentials.clientId,
      GOOGLE_CLIENT_SECRET: credentials.clientSecret
    });
    console.log('Google Photos Service: Credentials saved successfully to .env.');
    return true;
  } catch (err) {
    console.error('Google Photos Service: Failed to save credentials:', err.message);
    return false;
  }
}

/**
 * Build an authorization URL from the callback URI and current client ID.
 *
 * A falsy client ID logs and returns a relative sandbox-callback URL, encoding
 * the URI with encodeURIComponent. A truthy ID returns Google's absolute OAuth
 * URL with URLSearchParams encoding, offline access, authorization-code response,
 * consent prompt, and only the Picker media-items readonly scope. Neither branch
 * checks the client secret, validates the callback, or adds OAuth state.
 *
 * Native input coercion is preserved, not a supported non-string interface.
 * In particular, lone UTF-16 surrogates throw in the sandbox branch after logging,
 * but URLSearchParams replaces them in the OAuth branch. Encoding failures
 * propagate synchronously without an error log. For string inputs, no network,
 * clock, token mutation, or persistence effects occur. Credential reads and the
 * sandbox log keep this boundary in the service shell, not a pure projection.
 *
 * @param {string} redirectUri Callback URI, encoded without validation.
 * @returns {string} Relative sandbox URL or absolute Google authorization URL.
 * @throws {URIError} Sandbox encoding rejects malformed UTF-16 input.
 * @throws {TypeError} Native encoding rejects unsupported coercion inputs.
 */
function getGoogleAuthUrl(redirectUri) {
  if (!credentials.clientId) {
    console.log('Google Photos Service: Client ID not configured. Generating developmental sandbox auth URL.');
    return `/api/auth/google/sandbox-callback?redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: redirectUri,
    client_id: credentials.clientId,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'
    ].join(' ')
  };

  const qs = new URLSearchParams(options);
  return `${rootUrl}?${qs.toString()}`;
}

/**
 * Service-owned token state, not a detached or validated credential snapshot.
 * OAuth fields are accepted without runtime validation; expiry may be NaN.
 *
 * @typedef {object} GooglePhotoTokenState
 * @property {string | undefined} accessToken Conventional OAuth access token.
 * @property {string} refreshToken Returned token or the stored fallback.
 * @property {number} expiry Epoch milliseconds, using native numeric coercion.
 */

/**
 * Exchange an authorization code and replace the service's token state.
 *
 * If either client credential is absent, ignore the inputs and create mock
 * tokens using separate clock reads for the access token and one-hour expiry.
 * This branch logs outside the catch and performs no request or persistence.
 *
 * Otherwise POST URL-encoded inputs and credentials with the authorization-code
 * grant, awaiting JSON before replacement. Inputs and OAuth fields are not
 * validated; URLSearchParams and expiry arithmetic retain native coercion.
 * A falsy response refresh_token retains the stored token. Persistence trims
 * that token and skips empty/MOCK_ values without normalizing the in-memory value.
 *
 * Return the service-owned token object itself, not a copy. Clock or payload
 * failures before replacement retain the previous state, including for mocks.
 * Persistence runs after replacement: its failure rejects without rollback.
 * Network, HTTP (including error-body reads), JSON, clock, and persistence
 * failures in the OAuth branch are logged and rethrown; mock failures are not.
 * Requests, clock reads, mutation, persistence, and logging stay in this effect
 * shell; this is not a pure projection or a guarantee of valid credentials.
 *
 * @param {string} code Temporary authorization code; ignored in mock mode.
 * @param {string} redirectUri Callback URI; ignored in mock mode.
 * @returns {Promise<GooglePhotoTokenState>} The current mutable token object.
 * @throws {Error} Rejects on exchange, clock, or persistence failure.
 */
async function exchangeGoogleCode(code, redirectUri) {
  if (!credentials.clientId || !credentials.clientSecret) {
    console.log('Google Photos Service: Exchanging developmental sandbox token.');
    tokens = {
      accessToken: 'MOCK_ACCESS_TOKEN_XYZ_' + Date.now(),
      refreshToken: 'MOCK_REFRESH_TOKEN_ABC',
      expiry: Date.now() + 3600 * 1000
    };
    return tokens;
  }

  try {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const body = {
      code,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    };

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Token API responded with status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokens.refreshToken, // Google sometimes omits refresh_token on refresh
      expiry: Date.now() + (data.expires_in * 1000)
    };
    persistGoogleRefreshToken(tokens.refreshToken);

    return tokens;
  } catch (err) {
    console.error('Google Photos Service: Token exchange failed:', err.message);
    throw err;
  }
}

/**
 * Refresh the service's access token using its stored refresh token.
 *
 * Missing refresh tokens reject before any request or clock read. MOCK_ tokens
 * bypass OAuth and use two clock reads: one for the synthetic access token,
 * then one for its one-hour expiry. These branches are outside the logged catch.
 *
 * Otherwise POST URL-encoded credentials and the refresh-token grant to OAuth,
 * await JSON, then assign accessToken before reading the clock to assign expiry.
 * Keep the existing refresh token even when the response includes a replacement;
 * no token persistence occurs here. Response fields are not validated: missing
 * access_token resolves undefined, and expires_in retains numeric coercion.
 *
 * Network, HTTP, JSON, and assignment/clock failures in the OAuth branch are
 * logged and rethrown. Updates are not atomic: a clock failure can leave the
 * new access token with the previous expiry, including in the mock branch.
 * Token-state mutation, clock reads, requests, and logging stay in this effect
 * shell; this is not a pure projection or a guarantee of valid credentials.
 *
 * @returns {Promise<string | undefined>} Refreshed or synthetic access token.
 * @throws {Error} Rejects on missing refresh token or refresh/clock failure.
 */
async function refreshAccessToken() {
  if (!tokens.refreshToken) {
    throw new Error('Google Photos Service: No refresh token available. User must re-authenticate.');
  }

  if (tokens.refreshToken.startsWith('MOCK_')) {
    tokens.accessToken = 'MOCK_ACCESS_TOKEN_XYZ_' + Date.now();
    tokens.expiry = Date.now() + 3600 * 1000;
    return tokens.accessToken;
  }

  try {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const body = {
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token'
    };

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString()
    });

    if (!res.ok) {
      throw new Error(`Failed to refresh access token, status=${res.status}`);
    }

    const data = await res.json();
    tokens.accessToken = data.access_token;
    tokens.expiry = Date.now() + (data.expires_in * 1000);
    
    return tokens.accessToken;
  } catch (err) {
    console.error('Google Photos Service: Access token refresh failed:', err.message);
    throw err;
  }
}

/**
 * Resolve the service's access token, refreshing when required.
 *
 * With no access token, delegate to refresh when a refresh token exists;
 * otherwise reject as not authenticated. Neither branch reads the clock here.
 * With an access token, read the clock once and refresh only when fewer than
 * five minutes remain: exactly five minutes does not trigger refresh.
 *
 * Refresh is awaited and its result or rejection passes through, including
 * synthetic mock tokens. Clock failures also reject. Expiry comparison keeps
 * native coercion; missing or nonnumeric expiry values can reuse the token.
 * OAuth payloads are not validated, so a refresh may resolve undefined when
 * access_token is absent. This is not a guarantee of validity or real credentials.
 * Authentication state, clock reads, logging, network requests, and refresh
 * mutations remain in the service shell; this is not a pure projection.
 *
 * @returns {Promise<string | undefined>} Cached or refreshed access token.
 * @throws {Error} Rejects on missing authentication or refresh/clock failure.
 */
async function getValidToken() {
  if (!tokens.accessToken) {
    if (tokens.refreshToken) {
      return refreshAccessToken();
    }
    throw new Error('Google Photos Service: Not authenticated.');
  }
  // Refresh access token if it expires in less than 5 minutes
  if (Date.now() + 300 * 1000 > tokens.expiry) {
    console.log('Google Photos Service: Access token expired or near expiry, refreshing...');
    return await refreshAccessToken();
  }
  return tokens.accessToken;
}

/** @typedef {import('./googlePhotosCache.js').GooglePhotoMediaItem & {id: string}} GooglePhotoSyncInput */
/** @typedef {GooglePhotoSyncInput & {url: string; source: string}} GooglePhotoSyncRow */

/**
 * @typedef {object} GooglePhotoSyncOptions
 * @property {import('../domain/poolRetention.js').PoolPolicyInput} [poolPolicy] Post-union retention/cap policy.
 * @property {Date | string | number} [now] Acquisition/retention time; defaults to a new Date, not the base-URL freshness clock.
 * @property {(sessionId: string) => Promise<{mediaItems?: GooglePhotoSyncInput[]}>} [listMediaItems] Awaited Picker reader.
 * @property {() => GooglePhotoSyncRow[]} [readCache] Synchronous cache reader.
 * @property {(items: GooglePhotoSyncRow[]) => void} [writeCache] Synchronous retained-union writer.
 * @property {(items: GooglePhotoSyncRow[]) => void} [cleanMediaFiles] Synchronous retained-union cleanup.
 * @property {(items: GooglePhotoSyncRow[]) => Promise<void>} [downloadMediaItems] Background retained-union downloader.
 */

/**
 * Append/upsert selected Picker images, then apply policy to the union.
 *
 * Options destructuring precedes the catch. The default listing adapter requires
 * an access token before checking sessionId; refresh-token-only state fails this
 * guard. Injected listing bypasses it. A falsy sessionId then logs and returns []
 * without adapter calls. Await listing before reading the cache synchronously.
 * Missing/non-array mediaItems act as empty input, not a no-op: policy, writing,
 * cleanup, and download still run. Skip truthy MIME types not starting with
 * image; preserve missing MIME compatibility and user metadata via cache helpers.
 *
 * Return built incoming rows in order, including duplicate ids and rows removed
 * by policy, NOT the retained union. Write the deduplicated union after policy,
 * then log counts, clean files, and start downloading that same retained array.
 * Cache/cleanup adapters are synchronous; their return values are not awaited.
 * Download must return a promise: completion is not awaited, and rejection is
 * logged separately without rejecting an already successful sync.
 *
 * Synchronous adapter/start failures and listing rejection log and rethrow,
 * without rollback of prior writes or cleanup. Nullish thrown values can replace
 * the failure while reading err.message, including in the background handler.
 * Repeated syncs still run effects. Keep networking, cache access, cleanup,
 * downloads, and logging in this data-first effect shell; union and policy
 * projections remain separate from orchestration.
 *
 * @param {string | null | undefined} sessionId Picker session; falsy values skip after the token guard.
 * @param {GooglePhotoSyncOptions} [options={}] Defaults apply only to undefined adapter values.
 * @returns {Promise<GooglePhotoSyncRow[]>} Built incoming rows, not persisted pool size or download completion.
 * @throws {unknown} Rejects on options, authentication, listing, projection, or synchronous effect failures.
 */
async function syncGoogleAlbum(sessionId, {
  poolPolicy,
  now = new Date(),
  listMediaItems = listPickerMediaItems,
  readCache = getCachedMediaItems,
  writeCache = writeCachedMediaItems,
  cleanMediaFiles = cleanOrphanedMediaFiles,
  downloadMediaItems = downloadSyncMediaItems
} = {}) {
  try {
    if (!tokens.accessToken && listMediaItems === listPickerMediaItems) {
      throw new Error('Google Photos Service: No active token session.');
    }

    if (!sessionId) {
      console.log('Google Photos Service: No sessionId provided, skipping sync.');
      return [];
    }

    console.log(`Google Photos Service: Syncing selected items from session ${sessionId}...`);
    const { mediaItems } = await listMediaItems(sessionId);

    const cachedItems = readCache();
    const existingById = new Map(cachedItems.map((item) => [item.id, item]));

    const syncedItems = [];
    if (mediaItems && Array.isArray(mediaItems)) {
      for (const item of mediaItems) {
        const mimeType = getPickerItemMimeType(item);
        if (mimeType && !mimeType.startsWith('image')) continue;

        const existing = existingById.get(item.id) || {};
        const nextItem = buildCachedMediaItem(item, sessionId, existing, now);
        syncedItems.push(nextItem);
      }
    }

    const mergedItems = mergeSyncedMediaItems(syncedItems, cachedItems);
    const cachedItemsToKeep = applyPoolPolicy(now, poolPolicy)(mergedItems);
    writeCache(cachedItemsToKeep);
    console.log(
      `Google Photos Service: Picker sync session ${sessionId}: `
      + `incoming=${syncedItems.length}, existing=${cachedItems.length}, `
      + `merged=${mergedItems.length}, retained=${cachedItemsToKeep.length}, `
      + `policyDropped=${mergedItems.length - cachedItemsToKeep.length}.`
    );

    // Clean orphaned files and kick off background download of new files
    cleanMediaFiles(cachedItemsToKeep);
    downloadMediaItems(cachedItemsToKeep).catch((err) => {
      console.error('Google Photos Service: Error in background downloader:', err.message);
    });

    return syncedItems;
  } catch (err) {
    console.error('Google Photos Service: Picker session sync failed:', err.message);
    throw err;
  }
}

/**
 * Create a synthetic or authenticated Picker session from service-owned state.
 *
 * A falsy access token rejects before refresh, even with a refresh token.
 * A MOCK_ access token resolves a synthetic session using one clock read,
 * without checking expiry, refreshing, requesting, or mutating token state.
 * Otherwise await getValidToken() before POSTing an empty JSON object.
 * Successful response JSON is awaited and returned without shape validation.
 *
 * Guard, native startsWith, synthetic clock, and token-resolution failures
 * reject outside the request catch; token resolution keeps its own effects.
 * Request, unsuccessful-status body reads, and JSON failures enter the catch,
 * which logs err.message and rethrows the original value. Nullish thrown
 * values instead fail while reading err.message, replacing that rejection.
 * Authentication, clock, network, token refresh, and logging stay in this
 * effectful service shell; this is not a pure projection or validity guarantee.
 *
 * @returns {Promise<unknown>} Synthetic session or unvalidated response JSON.
 * @throws {unknown} Rejects on missing access token or branch-specific failures.
 */
async function createPickerSession() {
  if (!tokens.accessToken) {
    throw new Error('Google Photos Service: No active token session.');
  }

  if (tokens.accessToken.startsWith('MOCK_')) {
    return {
      id: 'MOCK_SESSION_ID_' + Date.now(),
      pickerUri: '/api/auth/google/sandbox-callback',
      mediaItemsSet: false
    };
  }

  const token = await getValidToken();
  try {
    const res = await fetch('https://photospicker.googleapis.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Picker Session API failed (${res.status}): ${errText}`);
    }

    return await res.json();
  } catch (err) {
    console.error('Google Photos Service: Failed to create picker session:', err.message);
    throw err;
  }
}

/**
 * Retrieve a synthetic or authenticated Picker session by its supplied id.
 *
 * Native startsWith dispatch happens before authentication or request handling.
 * MOCK_ ids resolve a fresh synthetic record without token, clock, or network
 * effects. Otherwise await getValidToken(), including refresh-token-only state,
 * then interpolate the id verbatim into the authenticated GET URL.
 * Successful response JSON is awaited and returned without shape validation.
 *
 * Input dispatch and token-resolution failures reject outside the request catch;
 * token resolution retains its own refresh, mutation, and logging effects.
 * Request, unsuccessful-status, and JSON failures enter the catch, which logs
 * the supplied id and err.message before rethrowing the original value. HTTP
 * failure bodies are not read. Nullish thrown values fail while reading
 * err.message instead, replacing that rejection without a session error log.
 * Authentication, clock, network, token refresh, and logging remain in this
 * effectful service shell; this is not a pure projection or validity guarantee.
 *
 * @param {string} sessionId Picker id; MOCK_ bypasses authentication.
 * @returns {Promise<unknown>} Synthetic record or unvalidated response JSON.
 * @throws {unknown} Rejects on input dispatch, token, or request failures.
 */
async function getPickerSession(sessionId) {
  if (sessionId.startsWith('MOCK_')) {
    return {
      id: sessionId,
      pickerUri: '/api/auth/google/sandbox-callback',
      mediaItemsSet: true
    };
  }

  const token = await getValidToken();
  try {
    const res = await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`Google Picker GET session failed (${res.status})`);
    }

    return await res.json();
  } catch (err) {
    console.error(`Google Photos Service: Failed to get session ${sessionId}:`, err.message);
    throw err;
  }
}

/**
 * List synthetic items or accumulate every page of a selected Picker session.
 *
 * Native startsWith dispatch precedes authentication and the request catch.
 * MOCK_ ids resolve fresh synthetic rows without token, clock, or network
 * effects. Otherwise await getValidToken() once, including refresh-token-only
 * state, and reuse that token across sequential default-GET requests.
 * Session ids and truthy page tokens are encoded with encodeURIComponent;
 * pageSize=50 is a request size, not a total-item limit. Await each JSON body
 * before requesting the next page. Append only array-valued mediaItems in
 * page order, retaining duplicates and raw element references without item
 * validation. Missing/non-array lists contribute nothing. Continue while
 * nextPageToken is truthy, with native coercion and no cycle or page bound.
 *
 * Input dispatch and token-resolution failures reject outside the catch.
 * Encoding, request, HTTP-body, and JSON failures log then rethrow, discarding
 * the accumulated result rather than resolving partial pages. HTTP failures
 * await text() and include it in the status error. Nullish JSON fails property
 * access; nullish thrown values instead fail while reading err.message,
 * replacing that rejection without a listing error log. Authentication,
 * network, token mutation, and logging remain in this effectful service shell.
 *
 * @param {string} sessionId Picker id; MOCK_ bypasses authentication.
 * @returns {Promise<{mediaItems: unknown[]}>} Fresh array of synthetic or unvalidated selected items.
 * @throws {unknown} Rejects on input dispatch, token, or page failures; no partial result.
 */
async function listPickerMediaItems(sessionId) {
  if (sessionId.startsWith('MOCK_')) {
    const mockItems = [];
    const picsumBase = 'https://picsum.photos/id';
    const mockIds = [10, 15, 29, 37, 43, 48, 54, 57, 62, 76, 85, 93, 104, 116, 122];
    mockIds.forEach((id) => {
      mockItems.push({
        id: `MOCK_MEDIA_ITEM_${id}`,
        baseUrl: `${picsumBase}/${id}/2560/1440`,
        mimeType: 'image/jpeg'
      });
    });
    return { mediaItems: mockItems };
  }

  const token = await getValidToken();
  const mediaItems = [];
  let pageToken = '';
  
  try {
    do {
      let url = `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${encodeURIComponent(sessionId)}&pageSize=50`;
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Google Picker MediaItems failed (${res.status}): ${errText}`);
      }

      const data = await res.json();
      if (data.mediaItems && Array.isArray(data.mediaItems)) {
        mediaItems.push(...data.mediaItems);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    return { mediaItems };
  } catch (err) {
    console.error('Google Photos Service: Failed to list picker media items:', err.message);
    throw err;
  }
}

/**
 * Delete a Picker session or acknowledge a synthetic no-op.
 *
 * Native startsWith dispatch precedes authentication and the request catch.
 * MOCK_ ids resolve true without token, clock, or network effects. Real ids
 * await getValidToken(), including refresh-token-only state, outside the catch.
 * Interpolate the id verbatim into one DELETE request with only a Bearer
 * authorization header; no request body or response body is read.
 *
 * Return response.ok directly: Fetch responses supply a boolean, but malformed
 * adapters are not validated or coerced. HTTP failures resolve false silently.
 * Request/property-access failures log and resolve false without rolling back
 * refreshed tokens. Input dispatch and authentication failures instead reject.
 * Nullish thrown values reject while reading err.message without a deletion
 * error log. Network, authentication, and logging stay in this effectful shell;
 * repeated real calls issue new requests, not a cached or idempotent guarantee.
 *
 * @param {string} sessionId Picker id; MOCK_ bypasses authentication.
 * @returns {Promise<boolean>} Synthetic acknowledgement, Fetch ok flag, or handled failure.
 * @throws {unknown} Rejects on input dispatch, authentication, or error-handler failure.
 */
async function deletePickerSession(sessionId) {
  if (sessionId.startsWith('MOCK_')) return true;

  const token = await getValidToken();
  try {
    const res = await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.ok;
  } catch (err) {
    console.error(`Google Photos Service: Failed to delete session ${sessionId}:`, err.message);
    return false;
  }
}

/**
 * Resolve a Google Photos media id to a content URL on demand.
 *
 * Synthetic `MOCK_` ids map to a Picsum fixture URL without authentication or
 * network access. Other ids use a valid Google token to request the media-item
 * resource, require its `baseUrl`, and compose a content URL with the supplied
 * render options. Authentication, fetch, and logging remain effectful here;
 * failures are logged and rethrown.
 *
 * @param {string} mediaItemId Stable Google Photos media-item id.
 * @param {GooglePhotoRenderOptions} [renderOptions={}] Optional content dimensions and crop directive.
 * @returns {Promise<string>} A mock fixture URL or rendered Google Photos content URL.
 */
async function refreshMediaItemUrl(mediaItemId, renderOptions = {}) {
  if (mediaItemId.startsWith('MOCK_')) {
    const idNum = mediaItemId.replace('MOCK_MEDIA_ITEM_', '');
    return `https://picsum.photos/id/${idNum}/2560/1440`;
  }

  try {
    const token = await getValidToken();
    const url = `https://photoslibrary.googleapis.com/v1/mediaItems/${mediaItemId}`;
    
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to retrieve media item, status=${res.status}`);
    }

    const item = await res.json();
    if (!item.baseUrl) {
      throw new Error('Google Photos Service: API returned media item without baseUrl');
    }

    return buildGooglePhotoContentUrl(item.baseUrl, renderOptions);
  } catch (err) {
    console.error(`Google Photos Service: Failed to refresh URL for item ${mediaItemId}:`, err.message);
    throw err;
  }
}

/**
 * Resolve and return image bytes for a Google Photos media item.
 *
 * A non-empty local file is returned immediately, using cached MIME metadata
 * or `image/jpeg`; an empty file is removed and fetched again. Cache lookup
 * and any normalization write precede path construction and file existence
 * checks, even on a local hit. A missing metadata row does not block a local
 * read. Non-empty hits return the original Buffer without reading render
 * options, authenticating, checking base-URL age, or fetching remote content.
 * MIME selection uses truthiness, not validation. Repeated calls read anew.
 *
 * Empty-file deletion follows its warning; read or unlink failures warn and
 * continue to the authenticated fetch path. Cache lookup, path construction,
 * and existence-check failures instead reject before authentication, outside
 * the local-file catch. Failures in its catch's warning handler also reject,
 * including a nullish caught value failing at err.message. Prior effects are
 * not rolled back. Path construction does not validate ids or enforce
 * containment.
 *
 * Otherwise await authentication before preparing deduplicated content-URL candidates.
 * A truthy Picker session triggers refresh only when its base URL is absent
 * or stale (inclusive 55-minute TTL). Append the rendered refreshed base first,
 * then the original cached base, even after refresh persists a replacement row.
 * Retain only truthy, exact-unique URLs in first-occurrence order; differing
 * strings are not canonicalized. Render options are forwarded unchanged.
 *
 * Picker refresh, persistence, and refreshed-URL projection failures warn and
 * fall through to the original cached base. The freshness check is outside
 * that catch; its clock failures reject without this warning. Warning-handler
 * failures also reject. Prior cache/token effects are not rolled back.
 * Cached-base projection is outside the catch and may reject after a handled
 * refresh failure. Only an empty candidate list awaits on-demand media URL
 * resolution, which can authenticate again; its rejection prevents retrieval.
 * No content request starts until preparation completes.
 *
 * Retrieve candidates sequentially with the initially resolved token (or empty
 * headers for synthetic MOCK_ ids). Only HTTP non-ok responses advance to the
 * next candidate; their bodies are not read. Thrown fetch, arrayBuffer,
 * Buffer conversion, write, and header-access failures reject immediately,
 * without another candidate or final refresh. Successful responses decode via
 * Buffer.from, write non-empty real-item bytes, then read the content-type
 * header. Empty buffers still succeed. MIME selection uses truthiness without
 * validation: response header, original cached MIME, then image/jpeg.
 *
 * After all HTTP failures, a truthy cached Picker session permits one final
 * refresh and one retry only for an exact URL not already tried. The retry
 * reuses the initially resolved token and original MIME hint, even if refresh
 * replaces service tokens or persists new metadata. Unlike the candidate loop,
 * this retry writes even empty real-item buffers before reading the header.
 * Synthetic ids skip content authentication and byte writes, not necessarily
 * Picker authentication or metadata persistence.
 *
 * Final refresh/projection/request/decoding/write/header failures are caught
 * as the last error; a retry HTTP failure supplies a distinct status error.
 * A duplicate URL retains the last candidate HTTP error. Exhaustion rejects
 * with a truthy last error verbatim; falsy caught values instead select the
 * media-specific fallback error. There is no retry after this final attempt,
 * no rollback of prior effects, and no additional logging in this catch.
 * Authentication, requests, file access, persistence, and logging remain in
 * this effectful service boundary, separate from pure cache/URL projections.
 *
 * @param {string} mediaItemId Stable Google Photos media-item id.
 * @param {GooglePhotoRenderOptions} [renderOptions={}] Optional content dimensions and crop directive.
 * @returns {Promise<GooglePhotoMediaBytes>} The fetched bytes and content type.
 * @throws {unknown} Rejects on unhandled cache, path, existence, warning, authentication, or retrieval failure.
 */
async function fetchMediaItemBytes(mediaItemId, renderOptions = {}) {
  const cachedItem = findCachedMediaItem(mediaItemId);
  const localFilePath = getLocalMediaFilePath(mediaItemId);
  if (fs.existsSync(localFilePath)) {
    try {
      const buffer = fs.readFileSync(localFilePath);
      if (buffer.length > 0) {
        return {
          buffer,
          contentType: cachedItem?.mimeType || 'image/jpeg'
        };
      }
      console.warn(`Google Photos Service: Local cached file for item ${mediaItemId} is 0 bytes, deleting and re-fetching.`);
      fs.unlinkSync(localFilePath);
    } catch (err) {
      console.warn(`Google Photos Service: Failed to read local cached file for item ${mediaItemId}, falling back to fetch:`, err.message);
    }
  }

  const contentTypeHint = cachedItem?.mimeType || 'image/jpeg';
  const requiresAuth = !mediaItemId.startsWith('MOCK_');
  const token = requiresAuth ? await getValidToken() : null;

  const candidates = [];
  const seenCandidates = new Set();
  const appendCandidate = (url) => {
    if (url && !seenCandidates.has(url)) {
      seenCandidates.add(url);
      candidates.push(url);
    }
  };

  if (cachedItem?.googlePickerSessionId && (!cachedItem.googleBaseUrl || isBaseUrlStale(cachedItem))) {
    try {
      const refreshedItem = await refreshCachedMediaItem(mediaItemId, cachedItem.googlePickerSessionId);
      if (refreshedItem?.googleBaseUrl) {
        appendCandidate(buildGooglePhotoContentUrl(refreshedItem.googleBaseUrl, renderOptions));
      }
    } catch (err) {
      console.warn(`Google Photos Service: Failed to refresh cached picker item ${mediaItemId}:`, err.message);
    }
  }

  if (cachedItem?.googleBaseUrl) {
    appendCandidate(buildGooglePhotoContentUrl(cachedItem.googleBaseUrl, renderOptions));
  }

  if (candidates.length === 0) {
    appendCandidate(await refreshMediaItemUrl(mediaItemId, renderOptions));
  }

  let lastError = null;

  for (const candidateUrl of candidates) {
    const res = await fetch(candidateUrl, {
      headers: requiresAuth ? { 'Authorization': `Bearer ${token}` } : {}
    });

    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!mediaItemId.startsWith('MOCK_') && buffer.length > 0) {
        fs.writeFileSync(localFilePath, buffer);
      }
      return {
        buffer,
        contentType: res.headers.get('content-type') || contentTypeHint
      };
    }

    lastError = new Error(`Google Photos media fetch failed (${res.status})`);
  }

  if (cachedItem?.googlePickerSessionId) {
    try {
      const refreshedItem = await refreshCachedMediaItem(mediaItemId, cachedItem.googlePickerSessionId);
      const refreshedUrl = buildGooglePhotoContentUrl(refreshedItem?.googleBaseUrl, renderOptions);

      if (refreshedUrl && !seenCandidates.has(refreshedUrl)) {
        const retryRes = await fetch(refreshedUrl, {
          headers: requiresAuth ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (retryRes.ok) {
          const buffer = Buffer.from(await retryRes.arrayBuffer());
          if (!mediaItemId.startsWith('MOCK_')) {
            fs.writeFileSync(localFilePath, buffer);
          }
          return {
            buffer,
            contentType: retryRes.headers.get('content-type') || contentTypeHint
          };
        }

        lastError = new Error(`Google Photos media fetch failed after picker refresh (${retryRes.status})`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`Google Photos Service: Failed to fetch media bytes for item ${mediaItemId}.`);
}

/**
 * Return a fresh set of left-hand values absent from the right-hand set.
 * Preserve left insertion order and native Set membership (SameValueZero for
 * primitives, reference identity for objects), without mutating either input.
 * Values are retained by reference, not cloned. With ordinary Sets this is a
 * pure data-first projection; custom iteration/membership hooks remain caller
 * effects and their failures propagate without validation or recovery.
 *
 * @template T
 * @param {ReadonlySet<T>} setA Values to retain unless excluded.
 * @param {ReadonlySet<T>} setB Values to exclude.
 * @returns {Set<T>} Detached set in left-hand insertion order.
 */
const difference = (setA, setB) => new Set([...setA].filter(x => !setB.has(x)));

/**
 * Project entries whose platform-parsed basename is absent from the active ids.
 * path.parse(...).name removes directories and only the final extension;
 * active ids match exactly, without trimming, decoding, or case folding.
 * Return a fresh array of original entries, preserving duplicates and order
 * without mutating either input. Empty active ids retain every entry.
 *
 * This pure data-first projection performs no filesystem access or deletion.
 * Inputs are not validated or coerced; native container/path failures and
 * caller-owned iteration/method hook failures propagate unchanged.
 *
 * @param {ReadonlyArray<string>} allFiles Directory entries or path strings to inspect.
 * @param {ReadonlyArray<string>} activeIds Exact media ids that must be retained.
 * @returns {string[]} Detached ordered entries whose parsed basename is not active.
 * @throws {unknown} Native input/path or caller-owned hook failure.
 */
const getOrphanedFiles = (allFiles, activeIds) => {
  const activeSet = new Set(activeIds);
  const fileIds = new Set(allFiles.map(file => path.parse(file).name));
  const orphans = difference(fileIds, activeSet);
  return allFiles.filter(file => orphans.has(path.parse(file).name));
};

/**
 * Project an id to a local JPG path without accessing the filesystem.
 *
 * Native template interpolation appends .jpg before path.join normalizes the
 * result against the module's fixed media directory. No trimming, encoding,
 * decoding, id validation, or containment validation is performed: dot segments
 * and separators can resolve outside that directory, and existing extensions
 * receive another .jpg suffix. Percent escapes remain literal path characters.
 *
 * This data-first projection reads no service state, clock, cache, or transport
 * and performs no persistence or logging. Native coercion hooks can have effects;
 * thrown values and coercion TypeErrors (including Symbols) propagate unchanged.
 *
 * @param {unknown} mediaItemId Value interpolated with the native string hint.
 * @returns {string} Normalized platform path, not a verified or confined file.
 * @throws {unknown} Native input coercion failure.
 */
const getLocalMediaFilePath = (mediaItemId) => path.join(MEDIA_DIR, `${mediaItemId}.jpg`);

/**
 * Remove locally cached files that are not represented by the supplied items.
 * A missing media directory and test mode are no-ops. Otherwise this reads the
 * directory, delegates orphan selection to `getOrphanedFiles(...)`, and
 * synchronously unlinks each result. Listing, projection, and unlink failures
 * are caught and warned; cleanup is best-effort and does not propagate them.
 *
 * @param {Array<{id: string}>} newItems Media items whose ids remain cached.
 * @returns {void}
 */
const cleanOrphanedMediaFiles = (newItems) => {
  if (!fs.existsSync(MEDIA_DIR) || process.env.NODE_ENV === 'test') {
    return;
  }
  try {
    const files = fs.readdirSync(MEDIA_DIR);
    const activeIds = newItems.map(item => item.id);
    const orphans = getOrphanedFiles(files, activeIds);
    orphans.forEach(file => {
      fs.unlinkSync(path.join(MEDIA_DIR, file));
      console.log(`Google Photos Service: Deleted orphaned local file: ${file}`);
    });
  } catch (err) {
    console.warn('Google Photos Service: Failed to clean up orphaned media files:', err.message);
  }
};

/**
 * Pre-download selected media into the local image cache in input order.
 *
 * Test mode is a no-op. Existing files are skipped regardless of their size;
 * missing files use the supplied base URL with the default render dimensions.
 * A missing base URL or non-OK response is silently skipped. URL construction,
 * fetching, body reads, and file writes are caught and warned per item so later
 * items still run. Path resolution and existence checks are outside that catch
 * and can reject the batch. Completion does not guarantee every item was saved.
 *
 * URL construction stays pure; sequential network requests, synchronous file
 * access, and logging remain in this service shell. No Picker refresh or
 * authentication is performed here.
 *
 * @param {ReadonlyArray<{id: string, googleBaseUrl?: string}>} items Selected media with stable ids and optional base URLs.
 * @returns {Promise<void>} Resolves after the sequential download attempts.
 */
const downloadSyncMediaItems = async (items) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  console.log(`Google Photos Service: Starting background download of ${items.length} media items...`);
  for (const item of items) {
    const filePath = getLocalMediaFilePath(item.id);
    if (!fs.existsSync(filePath)) {
      try {
        const url = buildGooglePhotoContentUrl(item.googleBaseUrl);
        if (url) {
          const res = await fetch(url);
          if (res.ok) {
            fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
            console.log(`Google Photos Service: Successfully pre-downloaded item: ${item.id}`);
          }
        }
      } catch (err) {
        console.warn(`Google Photos Service: Failed to pre-download media for item ${item.id}:`, err.message);
      }
    }
  }
};

/**
 * Read and normalize the persistent Google Photos cache for rendering.
 *
 * The pure map/filter/dedupe pipeline preserves open metadata, removes rows
 * without an id or usable base URL/Picker session (mock ids are exempt), and
 * retains the first usable row for each stable id in input order. This is
 * structural eligibility, not a network or local-file availability check;
 * retention and pool caps are not applied here.
 *
 * A missing file or caught read/JSON-parse failure returns an empty array.
 * Valid JSON is expected to contain an array; non-array shapes still throw.
 * Serialization changes trigger a synchronous cache write outside test mode;
 * unchanged rows and test-mode reads never write. Existence-check and write
 * failures propagate. File access and warnings remain in this service shell.
 *
 * @returns {Array<import('./googlePhotosCache.js').GooglePhotoMediaItem & {id: string; url: string}>}
 * Newly projected, source-local render rows with stable ids and proxy URLs.
 */
function getCachedMediaItems() {
  const rawItems = readCachedMediaItemsRaw();
  const normalizedItems = dedupeMediaItemsById(rawItems
    .map(normalizeCachedMediaItem)
    .filter(Boolean)
    .filter(isUsableCachedMediaItem));

  if (JSON.stringify(rawItems) !== JSON.stringify(normalizedItems) && process.env.NODE_ENV !== 'test') {
    writeCachedMediaItems(normalizedItems);
  }

  return normalizedItems;
}

/**
 * Report whether the service currently holds a truthy access token.
 *
 * This is a synchronous presence check, not token validation: expired,
 * synthetic, and malformed truthy values still return true. A refresh token
 * alone returns false; expiry and credentials are not inspected.
 * Reads current service-owned state on each call without coercion hooks,
 * mutation, clock reads, refresh, requests, persistence, or logging.
 * The boolean projection is deterministic for fixed state, but this zero-arg
 * service-state reader is not a pure function of explicit inputs.
 *
 * @returns {boolean} Native truthiness of the current access token.
 */
function isAuthenticated() {
  return !!tokens.accessToken;
}

module.exports = {
  applyCachedMediaItemMetadataToState,
  buildGooglePhotoMetadataPatch,
  saveGoogleCredentials,
  getGoogleAuthUrl,
  exchangeGoogleCode,
  syncGoogleAlbum,
  createPickerSession,
  getPickerSession,
  listPickerMediaItems,
  deletePickerSession,
  refreshMediaItemUrl,
  fetchMediaItemBytes,
  getCachedMediaItems,
  getGooglePhotoMediaItemId,
  isAuthenticated,
  isGooglePhotoProxyUrl,
  buildGooglePhotoProxyUrl,
  buildCachedMediaItem,
  mergeCachedMediaItemMetadata,
  normalizeCachedMediaItem,
  isUsableCachedMediaItem,
  dedupeMediaItemsById,
  mergeSyncedMediaItems,
  updateCachedMediaItemMetadata,
  difference,
  getOrphanedFiles,
  getLocalMediaFilePath,
  cleanOrphanedMediaFiles,
  downloadSyncMediaItems
};
