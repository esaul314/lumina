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

function persistGoogleRefreshToken(refreshToken) {
  const normalized = String(refreshToken || '').trim();
  if (!normalized || normalized.startsWith('MOCK_')) {
    return;
  }

  persistEnvVars({
    GOOGLE_REFRESH_TOKEN: normalized
  });
}

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

function writeCachedMediaItems(items) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(items, null, 2), 'utf8');
}

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

/**
 * 💾 syncGoogleAlbum
 * Retrieves selected items from the Google Photos Picker session and caches them.
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
 * 🛠️ createPickerSession
 * Creates a secure photo picking session.
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
 * 🔍 getPickerSession
 * Retrieves picking session details (used to check if user has selected items).
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
 * 📸 listPickerMediaItems
 * Lists selected media items in the picking session.
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
 * 🗑️ deletePickerSession
 * Cleans up the picking session.
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
 * or `image/jpeg`; an empty file is removed and fetched again. Otherwise the
 * service builds deduplicated content-URL candidates from a missing or stale
 * Picker refresh, the cached base URL, or an on-demand media URL refresh. A
 * failed candidate may trigger one final Picker refresh and retry. Synthetic
 * `MOCK_` ids skip authentication and disk writes; real items use a valid
 * token, and successful non-empty downloads are cached locally. Authentication,
 * Picker/network requests, file access, persistence, and logging remain in
 * this effectful service boundary.
 *
 * The returned content type prefers the response header and falls back to the
 * cached MIME type or `image/jpeg`. If retrieval cannot produce a successful
 * response, the promise rejects with the last fetch/refresh error or a
 * media-specific fallback error.
 *
 * @param {string} mediaItemId Stable Google Photos media-item id.
 * @param {GooglePhotoRenderOptions} [renderOptions={}] Optional content dimensions and crop directive.
 * @returns {Promise<GooglePhotoMediaBytes>} The fetched bytes and content type.
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

// Pure functional helpers for set difference and orphaned file mapping
const difference = (setA, setB) => new Set([...setA].filter(x => !setB.has(x)));

/**
 * Return directory entries whose parsed basename is absent from the active ids.
 * Matching ignores the file extension, and the result preserves input order.
 *
 * @param {string[]} allFiles Directory entries to inspect.
 * @param {string[]} activeIds Media ids that must be retained.
 * @returns {string[]} Entries whose parsed basename is not active.
 */
const getOrphanedFiles = (allFiles, activeIds) => {
  const activeSet = new Set(activeIds);
  const fileIds = new Set(allFiles.map(file => path.parse(file).name));
  const orphans = difference(fileIds, activeSet);
  return allFiles.filter(file => orphans.has(path.parse(file).name));
};

// File system effectful operations
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
