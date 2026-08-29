// @ts-check

import {
  getSelectedCategories,
  serializeCategorySelection
} from './categorySelection.js';

/**
 * @typedef {object} ClientPhoto
 * @property {string} url
 * @property {string=} title
 * @property {string=} author
 * @property {string=} category
 * @property {number=} cropPercent
 * @property {number=} cropPositionY
 * @property {string=} orientation
 * @property {boolean=} loved
 * @property {boolean=} preventPairing
 * @property {number=} rating
 */

/**
 * @typedef {object} ClientFrame
 * @property {ClientPhoto|null} primary
 * @property {ClientPhoto|null} secondary
 * @property {'single'|'split'} layout
 * @property {{primaryPercent?: number|null, primaryPositionY?: number|null, secondaryPercent?: number|null, secondaryPositionY?: number|null}} crop
 * @property {{category?: string|null, categories: string[], photoCount?: number, orientation?: string, splitEligible?: boolean}} context
 */

/**
 * The client accepts the server snapshot plus a small set of legacy aliases
 * while the REST and Socket.IO envelopes converge on the same frame shape.
 *
 * @typedef {Record<string, unknown> & {
 *   activePhoto?: ClientPhoto|null,
 *   activeSecondPhoto?: ClientPhoto|null,
 *   currentCategory?: string,
 *   currentFrame?: ClientFrame|null,
 *   playback?: {selectedCategories?: string[]}|null,
 *   photosList?: ClientPhoto[]|null,
 *   splitCropPercent?: number
 * }} ClientSnapshot
 */

/** @typedef {'primary'|'secondary'} PhotoEventSide */
/** @typedef {{side: PhotoEventSide, photo: ClientPhoto}} PhotoEventProjection */

/** @param {ClientSnapshot} snapshot @returns {ClientFrame} */
function buildFallbackFrame(snapshot) {
  const categories = getSelectedCategories(snapshot);
  const primary = snapshot?.activePhoto || null;
  const secondary = snapshot?.activeSecondPhoto || null;
  const layout = secondary ? 'split' : 'single';

  return {
    primary,
    secondary,
    layout,
    crop: {
      primaryPercent: primary?.cropPercent ?? null,
      primaryPositionY: primary?.cropPositionY ?? null,
      secondaryPercent: secondary?.cropPercent ?? snapshot?.splitCropPercent ?? 50,
      secondaryPositionY: secondary?.cropPositionY ?? null
    },
    context: {
      category: primary?.category || null,
      categories,
      photoCount: Array.isArray(snapshot?.photosList) ? snapshot.photosList.length : 0,
      orientation: primary?.orientation || 'unknown',
      splitEligible: Boolean(secondary)
    }
  };
}

/**
 * Normalize a legacy or canonical client snapshot into the shared frame
 * vocabulary without mutating the input value.
 *
 * @param {ClientSnapshot|null|undefined} snapshot
 * @returns {ClientSnapshot|null|undefined}
 */
export function normalizeSnapshot(snapshot) {
  if (!snapshot) {
    return snapshot;
  }

  const selectedCategories = getSelectedCategories(snapshot);
  const currentCategory = serializeCategorySelection(selectedCategories);
  const currentFrame = snapshot.currentFrame
    ? {
        ...snapshot.currentFrame,
        context: {
          ...snapshot.currentFrame.context,
          categories: selectedCategories
        }
      }
    : buildFallbackFrame({
        ...snapshot,
        currentCategory,
        playback: snapshot.playback
          ? { ...snapshot.playback, selectedCategories }
          : snapshot.playback
      });

  return {
    ...snapshot,
    currentCategory,
    playback: snapshot.playback
      ? { ...snapshot.playback, selectedCategories }
      : snapshot.playback,
    currentFrame,
    activePhoto: currentFrame.primary || snapshot.activePhoto || null,
    activeSecondPhoto: currentFrame.secondary || snapshot.activeSecondPhoto || null
  };
}

/**
 * Normalize either a direct snapshot or the `{ state: snapshot }` response
 * envelope used by durable mutations.
 *
 * Keeping the envelope compatibility rule beside snapshot normalization gives
 * reads, mutations, and live sync one pure boundary without coupling callers
 * to a transport-specific response shape.
 *
 * @param {unknown} response
 * @returns {ClientSnapshot|null|undefined}
 */
export const normalizeSnapshotResponse = (response) => (
  normalizeSnapshot(/** @type {ClientSnapshot|null|undefined} */ (response?.state || response))
);

/** @type {Record<PhotoEventSide, {activeKey: 'activePhoto'|'activeSecondPhoto', frameKey: 'primary'|'secondary'}>} */
const PHOTO_EVENT_TARGETS = {
  primary: { activeKey: 'activePhoto', frameKey: 'primary' },
  secondary: { activeKey: 'activeSecondPhoto', frameKey: 'secondary' }
};

/** @type {Record<string, PhotoEventSide>} */
const PHOTO_EVENT_SIDES = Object.freeze({
  'photo-update': 'primary',
  'second-photo-update': 'secondary'
});

/**
 * Project a wire-level photo event into the side-aware snapshot vocabulary.
 * The Socket.IO shell remains responsible for applying the immutable update.
 *
 * @param {string} event
 * @param {ClientPhoto} photo
 * @returns {PhotoEventProjection|null}
 */
export function projectPhotoEvent(event, photo) {
  const side = Object.prototype.hasOwnProperty.call(PHOTO_EVENT_SIDES, event)
    ? PHOTO_EVENT_SIDES[event]
    : null;
  return side ? { side, photo } : null;
}

/**
 * Apply a server photo event to both the legacy snapshot fields and the
 * canonical frame projection without mutating the received snapshot.
 *
 * @param {ClientSnapshot|null|undefined} snapshot
 * @param {PhotoEventSide|string} side
 * @param {ClientPhoto} photo
 * @returns {ClientSnapshot|null|undefined}
 */
export function applyPhotoEvent(snapshot, side, photo) {
  const target = PHOTO_EVENT_TARGETS[side];
  if (!snapshot || !target) {
    return snapshot;
  }

  return normalizeSnapshot({
    ...snapshot,
    [target.activeKey]: photo,
    currentFrame: snapshot.currentFrame
      ? { ...snapshot.currentFrame, [target.frameKey]: photo }
      : snapshot.currentFrame
  });
}

/**
 * Apply a confirmed photo metadata patch across all client snapshot aliases.
 *
 * @param {ClientSnapshot|null|undefined} snapshot
 * @param {string} url
 * @param {Record<string, unknown>} patch
 * @returns {ClientSnapshot|null|undefined}
 */
export function patchPhotoInSnapshot(snapshot, url, patch) {
  if (!snapshot || !url || !patch || typeof patch !== 'object') {
    return snapshot;
  }

  const currentFrame = getCurrentFrame(snapshot);
  const nextPrimary = currentFrame.primary?.url === url
    ? { ...currentFrame.primary, ...patch }
    : currentFrame.primary;
  const nextSecondary = currentFrame.secondary?.url === url
    ? { ...currentFrame.secondary, ...patch }
    : currentFrame.secondary;

  const nextCrop = {
    ...currentFrame.crop,
    ...(currentFrame.primary?.url === url && patch.cropPercent !== undefined ? { primaryPercent: patch.cropPercent } : {}),
    ...(currentFrame.primary?.url === url && patch.cropPositionY !== undefined ? { primaryPositionY: patch.cropPositionY } : {}),
    ...(currentFrame.secondary?.url === url && patch.cropPercent !== undefined ? { secondaryPercent: patch.cropPercent } : {}),
    ...(currentFrame.secondary?.url === url && patch.cropPositionY !== undefined ? { secondaryPositionY: patch.cropPositionY } : {})
  };

  return normalizeSnapshot({
    ...snapshot,
    currentFrame: {
      ...currentFrame,
      primary: nextPrimary,
      secondary: nextSecondary,
      crop: nextCrop
    },
    activePhoto: snapshot.activePhoto?.url === url
      ? { ...snapshot.activePhoto, ...patch }
      : snapshot.activePhoto,
    activeSecondPhoto: snapshot.activeSecondPhoto?.url === url
      ? { ...snapshot.activeSecondPhoto, ...patch }
      : snapshot.activeSecondPhoto,
    photosList: Array.isArray(snapshot.photosList)
      ? snapshot.photosList.map((photo) => (photo?.url === url ? { ...photo, ...patch } : photo))
      : snapshot.photosList
  });
}

/**
 * Prefer the server's canonical photo identity and metadata after a mutation.
 * This matters for source-local photos such as Google Photos, whose durable
 * metadata is keyed by the proxy-backed photo returned by the server.
 *
 * @param {string} requestedUrl
 * @param {Record<string, unknown>} requestedPatch
 * @param {unknown} response
 * @returns {{url: string, patch: Record<string, unknown>}}
 */
export function getConfirmedPhotoPatch(requestedUrl, requestedPatch, response) {
  const confirmedPhoto = response?.photo;

  return {
    url: confirmedPhoto?.url || requestedUrl,
    patch: {
      ...requestedPatch,
      ...(confirmedPhoto?.loved !== undefined ? { loved: confirmedPhoto.loved } : {})
    }
  };
}

/** @param {ClientSnapshot|null|undefined} state @returns {ClientFrame} */
export function getCurrentFrame(state) {
  return state?.currentFrame || buildFallbackFrame(state || /** @type {ClientSnapshot} */ ({}));
}

/**
 * @param {ClientSnapshot|null|undefined} state
 * @param {PhotoEventSide} [side='primary']
 * @returns {ClientPhoto|null}
 */
export function getFramePhoto(state, side = 'primary') {
  const frame = getCurrentFrame(state);
  return side === 'secondary' ? frame.secondary : frame.primary;
}

/** @param {ClientSnapshot|null|undefined} state @returns {boolean} */
export function isSplitFrameActive(state) {
  return getCurrentFrame(state).layout === 'split';
}

/** @param {ClientSnapshot|null|undefined} state @returns {string} */
export function getFrameOrientation(state) {
  return getCurrentFrame(state).context?.orientation || 'unknown';
}

/**
 * @param {ClientSnapshot|null|undefined} state
 * @param {string} url
 * @param {ClientPhoto|null} [fallback=null]
 * @returns {ClientPhoto|null}
 */
export function findPhotoByUrl(state, url, fallback = null) {
  if (!url) {
    return fallback;
  }

  const frame = getCurrentFrame(state);
  return [
    frame.primary,
    frame.secondary,
    state?.activePhoto,
    state?.activeSecondPhoto,
    ...(state?.photosList || [])
  ].find((photo) => photo?.url === url) || fallback;
}

/**
 * @param {ClientSnapshot|null|undefined} state
 * @param {string} url
 * @param {number} [fallbackPercent]
 * @param {number} [fallbackPositionY]
 * @returns {{cropPercent: number|undefined, cropPositionY: number|undefined}}
 */
export function getPhotoCropState(state, url, fallbackPercent = undefined, fallbackPositionY = undefined) {
  const frame = getCurrentFrame(state);

  if (frame.primary?.url === url) {
    return {
      cropPercent: frame.crop?.primaryPercent ?? frame.primary?.cropPercent ?? fallbackPercent,
      cropPositionY: frame.crop?.primaryPositionY ?? frame.primary?.cropPositionY ?? fallbackPositionY
    };
  }

  if (frame.secondary?.url === url) {
    return {
      cropPercent: frame.crop?.secondaryPercent ?? frame.secondary?.cropPercent ?? fallbackPercent,
      cropPositionY: frame.crop?.secondaryPositionY ?? frame.secondary?.cropPositionY ?? fallbackPositionY
    };
  }

  const photo = findPhotoByUrl(state, url);
  return {
    cropPercent: photo?.cropPercent ?? fallbackPercent,
    cropPositionY: photo?.cropPositionY ?? fallbackPositionY
  };
}
