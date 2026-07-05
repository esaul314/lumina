import {
  getSelectedCategories,
  serializeCategorySelection
} from './categorySelection.js';

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

export function getCurrentFrame(state) {
  return state?.currentFrame || buildFallbackFrame(state || {});
}

export function getFramePhoto(state, side = 'primary') {
  const frame = getCurrentFrame(state);
  return side === 'secondary' ? frame.secondary : frame.primary;
}

export function isSplitFrameActive(state) {
  return getCurrentFrame(state).layout === 'split';
}

export function getFrameOrientation(state) {
  return getCurrentFrame(state).context?.orientation || 'unknown';
}

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
