// @ts-check

const DEFAULT_RENDER_WIDTH = 2560;
const DEFAULT_RENDER_HEIGHT = 1440;
const GOOGLE_PHOTO_PROXY_PREFIX = '/api/google-photos/media/';

/**
 * Google Photos Picker records are open: fields owned by Lumina and Google
 * can evolve independently, while the cache boundary names the fields it uses.
 *
 * @typedef {Record<string, unknown> & {
 *   id?: string;
 *   url?: string;
 *   baseUrl?: string;
 *   googleBaseUrl?: string;
 *   googlePickerSessionId?: string;
 *   googleBaseUrlFetchedAt?: number;
 *   addedAt?: string;
 *   createTime?: string;
 *   mimeType?: string;
 *   width?: string | number;
 *   height?: string | number;
 *   mediaFile?: PickerMediaFile;
 *   mediaFileMetadata?: PickerMediaMetadata;
 *   rating?: unknown;
 *   isBroken?: unknown;
 *   cropPercent?: unknown;
 *   cropPositionY?: unknown;
 *   preventPairing?: unknown;
 *   loved?: unknown;
 *   orientation?: unknown;
 * }} GooglePhotoMediaItem
 */

/** @typedef {Record<string, unknown> & {width?: string | number; height?: string | number}} PickerMediaMetadata */

/**
 * @typedef {Record<string, unknown> & {
 *   baseUrl?: string;
 *   mimeType?: string;
 *   mediaFileMetadata?: PickerMediaMetadata;
 * }} PickerMediaFile
 */

/** @typedef {{width?: number; height?: number; crop?: boolean}} RenderOptions */

/** @typedef {'rating' | 'isBroken' | 'cropPercent' | 'cropPositionY' | 'preventPairing' | 'loved' | 'orientation' | 'width' | 'height'} GooglePhotoMetadataField */
/** @typedef {Partial<Record<GooglePhotoMetadataField, unknown>>} GooglePhotoMetadataInput */
/** @typedef {Array<GooglePhotoMediaItem | null | undefined>} CachedGooglePhotoRows */
/** @typedef {{items: CachedGooglePhotoRows; updatedItem: GooglePhotoMediaItem | null; changed: boolean}} CachedGooglePhotoMetadataMerge */

/**
 * Build the same-origin proxy URL used to render cached Picker media.
 *
 * Omitted/undefined options use {}; width/height independently default only
 * on undefined, and crop defaults to false. Native destructuring reads width,
 * height, then crop (including inherited/non-enumerable fields) before any
 * coercion. Null options throw; ordinary primitives use boxed property reads.
 * Width then height use String(...), without validation or clamping. Query
 * fields stay ordered w, h, then c=1 for truthy crop, without coercing crop.
 * URLSearchParams uses form encoding (spaces become '+') and replaces lone
 * surrogates in dimensions, unlike encodeURIComponent on the id.
 *
 * The id is encoded once, after dimension coercion, with native
 * encodeURIComponent: no trimming, truthy fallback, or identifier validation.
 * Empty ids still produce a URL; percent text is encoded again. For ordinary
 * well-formed string ids, the decoder round-trips successful builds regardless
 * of render options. This is a codec law, not URL-builder idempotence.
 * Ordinary read-only inputs stay unchanged; keep this pure data-first
 * projection separate from validation and cache/filesystem effects.
 *
 * Property-read/coercion failures propagate unchanged; null options and symbol
 * ids throw TypeError, and malformed UTF-16 ids throw URIError. Later reads or
 * coercions do not run after a failure, but prior caller-hook effects survive.
 * No fallback URL is returned.
 *
 * @param {string} mediaItemId
 * @param {Readonly<RenderOptions>} [options={}]
 * @returns {string} Relative proxy URL with an encoded id and ordered query.
 * @throws {unknown} Native property-read, coercion, or URI-encoding failure.
 */
function buildGooglePhotoProxyUrl(mediaItemId, { width = DEFAULT_RENDER_WIDTH, height = DEFAULT_RENDER_HEIGHT, crop = false } = {}) {
  const params = new URLSearchParams({
    w: String(width),
    h: String(height)
  });

  if (crop) {
    params.set('c', '1');
  }

  return `${GOOGLE_PHOTO_PROXY_PREFIX}${encodeURIComponent(mediaItemId)}?${params.toString()}`;
}

/**
 * Decode a media id only from Lumina's Google Photos proxy URL vocabulary.
 *
 * Falsy inputs select '' before native String(...) coercion; truthy inputs
 * use native coercion (the string hint for objects), then outer trimming.
 * Only the exact, case-sensitive relative prefix matches: absolute URLs
 * are not accepted.
 * The first literal '?' ends the encoded id; its suffix is ignored, even
 * when malformed. Empty ids return '' without decoding. Non-empty ids use
 * decodeURIComponent once: '+' and fragments stay literal, encoded separators
 * decode, and decoded whitespace is not trimmed again. No URL parser, id
 * validation, or filesystem containment check is implied.
 *
 * Ordinary inputs are unchanged. For well-formed UTF-16 string ids, decoding
 * buildGooglePhotoProxyUrl(id, options) returns id independently of render
 * options. This codec round-trip is not decoder idempotence: decoded ids are
 * not necessarily proxy URLs. Keep this pure data-first projection separate
 * from validation and cache/filesystem effects.
 *
 * Native coercion and malformed percent/UTF-8 decoding failures propagate;
 * unsupported prefixes return '' before decoding. Caller coercion-hook effects
 * are not rolled back, and no fallback result is returned after a failure.
 *
 * @param {unknown} value
 * @returns {string} Once-decoded, unvalidated id, or the empty-string fallback.
 * @throws {unknown} Native string-coercion failure or URIError from decoding.
 */
function getGooglePhotoMediaItemId(value) {
  const text = String(value || '').trim();
  if (!text.startsWith(GOOGLE_PHOTO_PROXY_PREFIX)) {
    return '';
  }

  const [encodedId] = text.slice(GOOGLE_PHOTO_PROXY_PREFIX.length).split('?');
  return encodedId ? decodeURIComponent(encodedId) : '';
}

/**
 * Read the nested Picker media file shape while tolerating legacy flat rows.
 *
 * @param {GooglePhotoMediaItem | null | undefined} item
 * @returns {PickerMediaFile}
 */
function getPickerMediaFile(item) {
  return item?.mediaFile && typeof item.mediaFile === 'object' ? item.mediaFile : item || {};
}

/**
 * Project a trimmed base URL from the selected Picker or legacy flat file.
 *
 * For ordinary data, truthy object-valued mediaFile (including arrays) wins;
 * otherwise use the row itself. Only the selected file's baseUrl is read:
 * missing/falsy nested bases do not fall back to the flat row's baseUrl.
 * Falsy bases select '' before native String(...) coercion, then trim().
 * Truthy values retain native string-hint coercion, including symbols and
 * arbitrary non-URL text; no URL validation, encoding, or directive stripping
 * is implied. Nullish rows and ordinary primitives without metadata yield ''.
 *
 * Reads include inherited/non-enumerable fields without enumerating keys.
 * The shared selector reads truthy mediaFile again for typeof and, when
 * object-valued, again for its result; changing accessors can alter selection
 * or fail natively. The selected baseUrl is read once.
 * Access/coercion failures propagate unchanged and stop subsequent work;
 * prior caller-hook effects are not rolled back, and no fallback is returned.
 *
 * Ordinary read-only data stays unchanged. The trim-normalized scalar is
 * stable under flat/nested re-embedding, not an endomorphism on media records.
 * Keep this pure data-first projection separate from cache-row clocks/I/O.
 * The cache-row builder applies its own cached/legacy fallback after trimming;
 * whitespace therefore permits that fallback, unlike a truthy whitespace
 * nested MIME hint suppressing the MIME helper's flat fallback.
 *
 * @param {Readonly<GooglePhotoMediaItem> | null | undefined} item
 * @returns {string} Trimmed, unvalidated base, or the empty-string fallback.
 * @throws {unknown} Native property-access or string-coercion failure.
 */
function getPickerItemBaseUrl(item) {
  return String(getPickerMediaFile(item).baseUrl || '').trim();
}

/**
 * Project a trimmed MIME hint from nested Picker or legacy flat metadata.
 *
 * For ordinary data, a truthy object-valued mediaFile (including arrays) is
 * selected; otherwise the row itself is used. A truthy selected mimeType wins,
 * then a truthy flat mimeType, then ''. Selection precedes String(...) and
 * trim(): whitespace suppresses fallback, case/parameters remain verbatim,
 * and arbitrary truthy values use native string coercion, not MIME validation.
 * Nullish rows and ordinary primitives without metadata return ''.
 *
 * Reads include inherited/non-enumerable properties without enumerating keys.
 * The shared file selector reads a truthy mediaFile again for typeof and, when
 * object-valued, again for its result. When the row itself is selected, a
 * falsy mimeType is read twice.
 * Accessors can therefore change selection or fail natively. No reads or
 * coercions occur after a failure; caller hook effects are not rolled back.
 *
 * Ordinary read-only data is unchanged. The output is trim-normalized and
 * stable when re-embedded as either a flat or nested MIME hint; this is a
 * scalar projection, not an endomorphism on media records. Keep validation
 * and network/cache effects outside this pure data-first boundary.
 *
 * @param {Readonly<GooglePhotoMediaItem> | null | undefined} item
 * @returns {string} Trimmed, unvalidated hint, or the empty-string fallback.
 * @throws {unknown} Native property-access or string-coercion failure.
 */
function getPickerItemMimeType(item) {
  return String(getPickerMediaFile(item).mimeType || item?.mimeType || '').trim();
}

/**
 * Project Picker dimensions from nested or legacy flat file metadata.
 *
 * The shared file selector uses truthy object-valued mediaFile (including
 * arrays), otherwise the row. Its truthy mediaFile reads repeat. A truthy
 * selected mediaFileMetadata wins as a whole, then flat mediaFileMetadata,
 * then {}: missing nested fields do not fall back individually. When the row
 * itself is selected, falsy metadata is read twice. Reads include inherited
 * and non-enumerable fields; truthy primitive metadata uses boxed reads.
 * Top-level row dimensions and existing cache dimensions are not consulted.
 *
 * Read and parse width before reading height, using native base-10 parseInt
 * (string-hint coercion). Numeric prefixes, fractions, and exponent notation
 * retain native behavior, not strict dimension validation. Each positive
 * finite parsed value wins independently; otherwise use 2560 for width or
 * 1440 for height. There is no safe-integer limit or maximum-size clamp.
 * Normalization is not globally idempotent under metadata re-embedding:
 * sufficiently large numeric results stringify in exponent notation.
 *
 * Ordinary read-only data stays unchanged; return a fresh dimension pair.
 * Keep this pure data-first projection separate from cache-row clocks/I/O.
 * Native access/coercion failures propagate unchanged, without reading later
 * fields or returning defaults; prior caller-hook effects are not rolled back.
 *
 * @param {Readonly<GooglePhotoMediaItem> | null | undefined} item
 * @returns {{width: number; height: number}} Independently defaulted dimensions.
 * @throws {unknown} Native property-access or integer-coercion failure.
 */
function getPickerItemDimensions(item) {
  const metadata = getPickerMediaFile(item).mediaFileMetadata || item?.mediaFileMetadata || {};
  const width = Number.parseInt(/** @type {string} */ (metadata.width), 10);
  const height = Number.parseInt(/** @type {string} */ (metadata.height), 10);

  return {
    width: Number.isFinite(width) && width > 0 ? width : DEFAULT_RENDER_WIDTH,
    height: Number.isFinite(height) && height > 0 ? height : DEFAULT_RENDER_HEIGHT
  };
}

/**
 * Recover an unvalidated base from a legacy cache URL.
 *
 * Falsy inputs select '' before native String(...) coercion; truthy values
 * use native string-hint coercion, including symbols, then outer trimming.
 * Empty text, the exact case-sensitive relative proxy prefix, and the
 * 'undefined=' prefix return ''. Absolute proxy URLs and prefix lookalikes
 * are not rejected. No URL parsing, decoding, or validation is implied.
 *
 * Split at the first literal '=' regardless of its context (including query
 * strings); discard the entire suffix. An empty head returns ''. The head
 * is not trimmed again, so whitespace immediately before '=' survives.
 * This projection is not globally idempotent: 'base =w10' yields 'base ',
 * which yields 'base' on another pass. Trim-normalized, equals-free,
 * non-rejected strings are fixed points.
 *
 * Ordinary inputs stay unchanged. Native coercion failures propagate exactly
 * without a fallback result; prior caller-hook effects are not rolled back.
 * Keep this pure data-first projection separate from cache-row clocks/I/O.
 * Callers short-circuit before legacy extraction when a preferred base wins;
 * the builder retains the head verbatim, while normalization trims it again
 * and projects an empty result to undefined.
 *
 * @param {unknown} url
 * @returns {string} Unvalidated first head, or the empty-string fallback.
 * @throws {unknown} Native string-coercion failure.
 */
function extractLegacyBaseUrl(url) {
  const value = String(url || '').trim();
  if (!value || value.startsWith(GOOGLE_PHOTO_PROXY_PREFIX) || value.startsWith('undefined=')) {
    return '';
  }

  const [baseUrl] = value.split('=');
  return baseUrl || '';
}

/**
 * Build a durable cache row from read-only Picker and existing metadata.
 *
 * Project Picker dimensions first (cached dimensions are ignored), then a
 * trimmed Picker base, truthy cached base verbatim, or legacy URL head.
 * Creation time selects a truthy Picker value, cached value, or '' before
 * String/trim; whitespace therefore suppresses the cached date. Existing
 * truthy addedAt survives verbatim, even if invalid; otherwise convert addedAt
 * with new Date(...).toISOString(). Omitted/undefined addedAt reads Date.now()
 * before the body, even if the existing timestamp wins or later work fails.
 *
 * Return a fresh fixed-field row, not a spread of either input. Id is read
 * separately for the output and proxy encoding; the proxy uses default render
 * dimensions. Session uses truthy supplied/cached precedence. A truthy resolved
 * base reads Date.now() again for fetched-at; otherwise retain the cached value.
 * MIME selects the trimmed Picker hint, truthy cached hint verbatim, or JPEG.
 * Rating defaults only on undefined; crop, pairing, and loved values come only
 * from existing metadata, without normalization. Creation time is omitted when
 * empty; other named fields remain present even when undefined. Unknown fields
 * and symbols are not copied. Inherited/hidden named fields are still read,
 * and a defined existing rating is read twice. Nested retained values alias
 * the original metadata; ordinary read-only inputs stay unchanged.
 *
 * Keep the data-first interface and pure helper composition; this builder is
 * clock-dependent, not a pure endomorphism or an idempotent normalization.
 * Clock injection/refactoring and validation are separate changes. There is no
 * cache I/O here. Read/coercion/date/encoding/clock failures propagate unchanged,
 * stop later work, and return no partial row. Prior caller-hook effects survive.
 * An invalid new acquisition date throws RangeError, but a truthy cached date
 * bypasses conversion. No recovery or metadata rollback is attempted.
 *
 * @param {Readonly<GooglePhotoMediaItem & {id: string}>} item
 * @param {string} sessionId
 * @param {Readonly<GooglePhotoMediaItem>} [existing={}] Undefined alone defaults.
 * @param {Date | string | number} [addedAt=Date.now()]
 * @returns {GooglePhotoMediaItem & {id: string; url: string; source: string}} Fresh shallow row.
 * @throws {unknown} Native read, coercion, date, URI-encoding, or clock failure.
 */
function buildCachedMediaItem(item, sessionId, existing = {}, addedAt = Date.now()) {
  const { width, height } = getPickerItemDimensions(item);
  const googleBaseUrl = getPickerItemBaseUrl(item) || existing.googleBaseUrl || extractLegacyBaseUrl(existing.url);
  const createTime = String(item?.createTime || existing.createTime || '').trim();
  const existingAddedAt = existing.addedAt;
  const normalizedAddedAt = existingAddedAt || new Date(addedAt).toISOString();

  return {
    id: item.id,
    title: 'Google Photos Picker Cast',
    author: 'Lumina Google Cast',
    source: 'google_photos',
    url: buildGooglePhotoProxyUrl(item.id),
    googleBaseUrl,
    googlePickerSessionId: sessionId || existing.googlePickerSessionId,
    googleBaseUrlFetchedAt: googleBaseUrl ? Date.now() : existing.googleBaseUrlFetchedAt,
    addedAt: normalizedAddedAt,
    ...(createTime ? { createTime } : {}),
    mimeType: getPickerItemMimeType(item) || existing.mimeType || 'image/jpeg',
    width,
    height,
    rating: existing.rating !== undefined ? existing.rating : 10,
    cropPercent: existing.cropPercent,
    cropPositionY: existing.cropPositionY,
    preventPairing: existing.preventPairing,
    loved: existing.loved
  };
}

/**
 * Normalize a persisted cache record into Lumina's stable render shape.
 *
 * A nullish row or falsy id returns null before other reads. This is a truthy
 * guard, not identifier validation: native property reads also accept inherited
 * ids and boxed primitives. Parse the row's width then height with native
 * base-10 parseInt; each positive finite result survives independently, otherwise
 * use 2560/1440. Nested Picker dimensions are ignored; no safe-integer cap applies.
 * Select a truthy googleBaseUrl before legacy URL extraction, then String/trim;
 * whitespace can suppress fallback and normalize to undefined. Preferred bases
 * retain equals signs. URL validity and structural eligibility are not checked.
 *
 * Spread own enumerable fields (including symbols) into a fresh plain object,
 * retaining shallow metadata aliases, then override source, proxy URL, base,
 * dimensions, rating, and loved. The proxy uses default render dimensions, not
 * the parsed row dimensions. Only undefined ratings become 10; loved is true
 * only for literal true. Inherited/hidden metadata is not spread, but named reads
 * still see it. Accessors may run repeatedly: id at guard/spread/proxy stages,
 * and a defined rating at spread/check/value stages when enumerable.
 *
 * Ordinary read-only records stay unchanged. On ordinary records with an own
 * enumerable string id and safe positive integer dimensions, normalization is value-idempotent,
 * not reference-idempotent. It is not globally idempotent: a large parsed number
 * can stringify exponentially and parse differently on the next pass. Keep this
 * pure data-first projection separate from eligibility, clocks, and cache I/O.
 *
 * Read/coercion/spread/URI failures propagate unchanged and stop later work;
 * no partial result or fallback row is returned. Prior caller-hook effects are
 * not rolled back. Spread runs after dimension/base projection, before proxy
 * encoding, rating, and loved reads.
 *
 * @param {Readonly<GooglePhotoMediaItem> | null | undefined} item
 * @returns {(GooglePhotoMediaItem & {id: string; url: string; width: number; height: number; loved: boolean}) | null}
 * @throws {unknown} Native property-read, coercion, spread, or URI-encoding failure.
 */
function normalizeCachedMediaItem(item) {
  if (!item?.id) {
    return null;
  }

  const width = Number.parseInt(/** @type {string} */ (item.width), 10);
  const height = Number.parseInt(/** @type {string} */ (item.height), 10);
  const safeWidth = Number.isFinite(width) && width > 0 ? width : DEFAULT_RENDER_WIDTH;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : DEFAULT_RENDER_HEIGHT;
  const googleBaseUrl = String(item.googleBaseUrl || extractLegacyBaseUrl(item.url) || '').trim();

  return {
    ...item,
    source: 'google_photos',
    url: buildGooglePhotoProxyUrl(item.id),
    googleBaseUrl: googleBaseUrl || undefined,
    width: safeWidth,
    height: safeHeight,
    rating: item.rating !== undefined ? item.rating : 10,
    loved: item.loved === true
  };
}

/**
 * Test structural cache eligibility, not whether media bytes are reachable.
 * Nullish rows or falsy id/url fields return false, reading id before url.
 * A surviving id is read again and receives a native startsWith('MOCK_')
 * call: the exact case-sensitive prefix bypasses refreshability reads, but
 * never the id/url guard. No explicit coercion, trimming, or validation is added.
 * Non-string ids can throw or supply their own startsWith method; its receiver
 * is the id, and its result is tested for truthiness rather than literal true.
 *
 * Other rows return Boolean(googleBaseUrl || googlePickerSessionId). A truthy
 * base skips the session read; whitespace and other truthy values qualify
 * without coercion. This does not check expiry, authentication, URL validity,
 * broken/rating flags, MIME, or local files. Retrieval remains in the shell.
 * Native reads include inherited/non-enumerable fields, without enumeration.
 * Ordinary read-only inputs remain unchanged; the pure data-first predicate
 * composes directly with filter, whose repeated application retains the same
 * row references for ordinary records. The predicate is not an endomorphism
 * on records; do not confuse filter idempotence with predicate idempotence.
 *
 * Property-read and method-call failures propagate unchanged, with no fallback
 * boolean or later reads. Prior caller-hook effects are not rolled back.
 *
 * @param {Readonly<GooglePhotoMediaItem> | null | undefined} item
 * @returns {boolean} Structural eligibility only, not successful retrieval.
 * @throws {unknown} Native property-read or startsWith method-call failure.
 */
function isUsableCachedMediaItem(item) {
  if (!item?.id || !item?.url) {
    return false;
  }

  if (item.id.startsWith('MOCK_')) {
    return true;
  }

  return Boolean(item.googleBaseUrl || item.googlePickerSessionId);
}

/**
 * Keep the first row for each nonempty String(item?.id || '').trim() key.
 * Truthiness precedes native string coercion: falsy ids are discarded, while
 * truthy numbers, symbols, and custom coercion hooks follow String semantics.
 * Keys are case-sensitive and trimmed only for comparison; retained ids,
 * metadata, and nested references are not rewritten, merged, or validated.
 * Inherited/non-enumerable ids are read once per visited row, even duplicates;
 * unrelated fields are not read or enumerated. Eligibility is a separate step.
 *
 * Omitted/undefined input uses []. Native items.filter dispatch is preserved;
 * null or a non-callable filter throws rather than returning an empty fallback.
 * Ordinary arrays produce a fresh dense array of original row references in
 * first-occurrence order. Native filter skips holes, visits inherited indices,
 * and snapshots length; custom methods/species retain their native behavior.
 * Ordinary read-only inputs remain unchanged. The private Set is local scratch
 * state, not an observable mutation or a reason to wrap this data-first helper.
 *
 * For ordinary records with stable keys, deduplication is value-idempotent.
 * On deduplicated arrays, dedupe([...left, ...right]) forms an associative,
 * first-biased Monoid on values with [] as identity, not reference identity.
 * It is not commutative or a homomorphism into plain array concatenation.
 *
 * Native filter/property/coercion failures propagate unchanged, stop later
 * work, and return no partial result; prior caller-hook effects are not undone.
 * Keep validation, recovery, clocks, and cache I/O outside this pure boundary.
 *
 * @template {Readonly<GooglePhotoMediaItem>} T
 * @param {ReadonlyArray<T>} [items=[]]
 * @returns {T[]} Original row aliases for ordinary array inputs.
 * @throws {unknown} Native filter, property-read, or string-coercion failure.
 */
function dedupeMediaItemsById(items = []) {
  const seenIds = new Set();

  return items.filter((item) => {
    const mediaItemId = String(item?.id || '').trim();
    if (!mediaItemId || seenIds.has(mediaItemId)) {
      return false;
    }

    seenIds.add(mediaItemId);
    return true;
  });
}

/**
 * Project only metadata fields Lumina allows users to edit on cached rows.
 * Read rating, isBroken, cropPercent, cropPositionY, preventPairing, loved,
 * orientation, width, and height eagerly in that order, then omit undefined.
 * Native property reads include inherited and non-enumerable fields; unsupported
 * keys are neither enumerated nor read. Other values remain unvalidated and
 * uncoerced, including false, zero, null, NaN, and reference-valued metadata.
 *
 * Return a fresh plain object with own enumerable writable/configurable fields
 * in allowlist order. Nested references remain shared; no input assignment or
 * cache I/O occurs. Omitted/undefined input uses {}, but null throws; other
 * primitives follow native property access rather than a record-type guard.
 *
 * For ordinary data records, projection is value-idempotent, not reference-
 * idempotent. Projected patches form a right-biased spread Monoid on values
 * with {} as identity. Projection is not a homomorphism from raw spread:
 * a later undefined field erases a raw value but is absent after projection.
 *
 * Property-access failures escape unchanged, stop later reads, and return no
 * partial patch. Purity assumes ordinary data: getter/proxy effects can survive
 * failure and are not rolled back. Keep validation and recovery policy separate.
 *
 * @param {Readonly<GooglePhotoMetadataInput>} [metadata={}]
 * @returns {GooglePhotoMetadataInput}
 * @throws {unknown} Native null access or caller-supplied property-read failure.
 */
function buildGooglePhotoMetadataPatch(metadata = {}) {
  return Object.fromEntries(
    Object.entries({
      rating: metadata.rating,
      isBroken: metadata.isBroken,
      cropPercent: metadata.cropPercent,
      cropPositionY: metadata.cropPositionY,
      preventPairing: metadata.preventPairing,
      loved: metadata.loved,
      orientation: metadata.orientation,
      width: metadata.width,
      height: metadata.height
    }).filter(([, value]) => value !== undefined)
  );
}

/**
 * Immutably merge an allowlisted metadata patch into matching cached rows.
 * Decode a same-origin proxy id once, otherwise trim the truthy identifier's
 * string form. Decoded ids are not retrimmed; rows match by strict id equality,
 * without row coercion, URL fallback, normalization, deduplication, or policy.
 * Identifier decoding precedes eager patch projection, both before any guard
 * or mapping. Undefined patch fields are omitted; other values are unvalidated.
 *
 * Every call maps a new array and shallow-copies every truthy row, including
 * unmatched rows and no-ops. Nullish collections become empty arrays; falsy
 * entries and sparse holes survive. Nested references remain shared. Every
 * matching occurrence receives the patch; updatedItem aliases the last matching
 * output row, even when changed is false. Missing ids/matches and empty patches
 * return null updatedItem. No input assignment or cache I/O occurs here.
 *
 * changed ORs strict !== comparisons over all matches: NaN counts as changed,
 * signed zero does not, and object values compare by reference, not structure.
 * For ordinary records and a fixed id, projected patches compose by right-biased
 * spread on row values, with {} as value identity, not reference identity.
 * Project each patch before composing: a later undefined field must not erase
 * an earlier defined field. Repeated scalar patches are value-idempotent;
 * changed is not a compositional summary (reverting patches can cancel).
 *
 * Native decoding, property access, spread, or map failures escape unchanged;
 * no partial result is returned. Purity assumes ordinary data: caller-supplied
 * accessors/coercion hooks can have effects which this helper cannot roll back.
 *
 * @param {Readonly<CachedGooglePhotoRows> | null | undefined} items
 * @param {unknown} mediaIdentifier
 * @param {GooglePhotoMetadataInput} [metadata={}]
 * @returns {CachedGooglePhotoMetadataMerge}
 * @throws {unknown} Identifier, patch, or row projection failure.
 */
function mergeCachedMediaItemMetadata(items, mediaIdentifier, metadata = {}) {
  const mediaItemId = getGooglePhotoMediaItemId(mediaIdentifier) || String(mediaIdentifier || '').trim();
  const metadataPatch = buildGooglePhotoMetadataPatch(metadata);

  if (!mediaItemId || Object.keys(metadataPatch).length === 0) {
    return {
      items: (items || []).map((item) => (item ? { ...item } : item)),
      updatedItem: null,
      changed: false
    };
  }

  let updatedItem = null;
  let changed = false;

  const nextItems = (items || []).map((item) => {
    if (!item || item.id !== mediaItemId) {
      return item ? { ...item } : item;
    }

    const nextItem = { ...item, ...metadataPatch };
    updatedItem = nextItem;
    changed = Object.keys(metadataPatch).some((key) => item[key] !== nextItem[key]) || changed;
    return nextItem;
  });

  return {
    items: nextItems,
    updatedItem,
    changed
  };
}

const GOOGLE_PHOTOS_USER_METADATA_FIELDS = [
  'rating',
  'cropPercent',
  'cropPositionY',
  'preventPairing',
  'loved'
];

/**
 * Prefer the latest synced representation while retaining existing user edits.
 * Spread existing then synced own enumerable string/symbol fields into a fresh
 * plain object. Synced values win even when undefined, except for rating,
 * cropPercent, cropPositionY, preventPairing, and loved: each existing value
 * other than undefined wins, including null, false, zero, NaN, and references.
 * isBroken, orientation, dimensions, and other metadata are not user-edit
 * exceptions here. No validation, coercion, deletion, or deep merge occurs.
 *
 * After both spreads, read those five existing fields in allowlist order,
 * including inherited/non-enumerable fields. Each defined guard triggers a
 * second read for assignment, without rechecking that result. Accessors may
 * therefore produce different values; ordinary data remains unchanged. Output
 * fields are own enumerable writable/configurable data properties, with nested
 * aliases shared. Native spread ignores nullish inputs and boxes primitives;
 * callers normally supply records, and this helper does not validate ids.
 *
 * For ordinary own-enumerable data records, this pure data-first merge is
 * associative and value-idempotent, not reference-idempotent or commutative.
 * Empty metadata is a value identity ({} for records without an attached id);
 * first-defined user edits and last-present other fields compose independently.
 * These laws do not extend to inherited fields or changing accessors. Keep the
 * small existing interface rather than adding a curried/algebraic wrapper.
 *
 * Native spread/property-read failures propagate unchanged, stop later work,
 * and return no partial result. Prior caller-hook effects are not rolled back.
 * Keep cache I/O, policy, identity matching, and recovery in their callers.
 *
 * @param {Readonly<GooglePhotoMediaItem>} existing
 * @param {Readonly<GooglePhotoMediaItem>} synced
 * @returns {GooglePhotoMediaItem} Fresh shallow representation with user edits.
 * @throws {unknown} Native spread or user-metadata property-read failure.
 */
function mergeSyncedItemWithExistingMetadata(existing, synced) {
  const merged = { ...existing, ...synced };

  GOOGLE_PHOTOS_USER_METADATA_FIELDS.forEach((field) => {
    if (existing?.[field] !== undefined) {
      merged[field] = existing[field];
    }
  });

  return merged;
}

/**
 * Accumulate Picker rows without changing ordinary read-only inputs.
 * Deduplicate cached rows first (first trimmed key wins), then gather synced
 * rows using String(item?.id || '').trim(): skip empty keys, retain first-key
 * order, but let the last row for each key win. Keys are case-sensitive and
 * comparison-only; neither original ids nor other metadata are validated.
 * Cached removal and lookup use raw ids against synced string keys, not trimmed
 * cached keys. Padded/numeric cached ids can therefore survive beside a synced
 * equivalent, and an earlier padded cached duplicate can hide an exact match.
 *
 * Return unselected cached rows first as fresh shallow plain objects, then
 * synced keys in first-seen order. Exact cached matches use the pair merge
 * (latest fields plus five defined existing user edits); unmatched synced rows
 * retain their original aliases. Nested metadata remains shared in all cases.
 * Omitted cached input defaults to []; null does not. Falsy synced input uses
 * []; truthy inputs dispatch native forEach. Ordinary sparse-array holes are
 * skipped, inherited indices visited, and traversal lengths captured natively.
 *
 * For ordinary own-enumerable records with unique nonempty trimmed string ids,
 * combine(cached, synced) = mergeSyncedMediaItems(synced, cached) is associative
 * and value-idempotent with [] as a two-sided identity: a noncommutative Monoid
 * on values, not references. These laws exclude duplicate/noncanonical ids,
 * inherited fields, and changing accessors. Keep the existing pure data-first
 * interface and private scratch collections rather than adding a wrapper.
 *
 * Cached deduplication finishes before synced traversal; gathering finishes
 * before cached filtering/cloning; all retained cached clones precede matched
 * pair merges. Native method/read/coercion/spread failures propagate unchanged,
 * stop later work, and return no partial result; prior caller-hook effects are
 * not rolled back. Retention/capping, cache I/O, and recovery stay in callers.
 *
 * @param {ReadonlyArray<Readonly<GooglePhotoMediaItem>> | null | undefined} syncedItems
 * @param {ReadonlyArray<Readonly<GooglePhotoMediaItem>>} [cachedItems=[]]
 * @returns {GooglePhotoMediaItem[]} Fresh array with cloned cached/matched rows and unmatched synced aliases.
 * @throws {unknown} Native collection, property-read, coercion, or spread failure.
 */
function mergeSyncedMediaItems(syncedItems, cachedItems = []) {
  const uniqueCachedItems = dedupeMediaItemsById(cachedItems);
  const syncedById = new Map();
  const syncedOrder = [];

  (syncedItems || []).forEach((item) => {
    const mediaItemId = String(item?.id || '').trim();
    if (!mediaItemId) {
      return;
    }

    if (!syncedById.has(mediaItemId)) {
      syncedOrder.push(mediaItemId);
    }
    syncedById.set(mediaItemId, item);
  });

  const merged = uniqueCachedItems
    .filter((item) => !syncedById.has(item.id))
    .map((item) => ({ ...item }));

  syncedOrder.forEach((mediaItemId) => {
    const syncedItem = syncedById.get(mediaItemId);
    const existingItem = uniqueCachedItems.find((item) => item.id === mediaItemId);
    merged.push(existingItem
      ? mergeSyncedItemWithExistingMetadata(existingItem, syncedItem)
      : syncedItem);
  });

  return merged;
}

module.exports = {
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
};
