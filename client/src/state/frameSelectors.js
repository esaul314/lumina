function buildFallbackFrame(snapshot) {
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
      categories: snapshot?.currentCategory ? String(snapshot.currentCategory).split(',').map((item) => item.trim()).filter(Boolean) : [],
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

  const currentFrame = snapshot.currentFrame || buildFallbackFrame(snapshot);

  return {
    ...snapshot,
    currentFrame,
    activePhoto: currentFrame.primary || snapshot.activePhoto || null,
    activeSecondPhoto: currentFrame.secondary || snapshot.activeSecondPhoto || null
  };
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
