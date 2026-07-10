// @ts-check

/**
 * @typedef {import('./types').CollectionsState} CollectionsState
 * @typedef {import('./types').CurrentFrame} CurrentFrame
 * @typedef {import('./types').DomainState} DomainState
 * @typedef {import('./types').Photo} Photo
 * @typedef {import('./types').PhotoOrientation} PhotoOrientation
 */

const DEFAULT_SPLIT_CROP = 50;
const GOOGLE_PHOTOS_CATEGORY = 'Google Photos';

const CATEGORY_ALIASES = Object.freeze({
  'Liminal Space': 'Liminal Spaces',
  'Liminal Spaces': 'Liminal Spaces',
  'AI Creation': 'AI Creations',
  'AI Creations': 'AI Creations'
});

function normalizeCategoryName(name) {
  const cleanName = String(name ?? '').trim();
  return CATEGORY_ALIASES[cleanName] ?? cleanName;
}

function uniqueStrings(values) {
  return [...new Set(values)];
}

function normalizeCategorySelection(input, availableCategories, fallbackCategory = availableCategories[0] ?? 'Scenic Nature') {
  const normalized = uniqueStrings(
    (Array.isArray(input) ? input : String(input ?? '').split(','))
      .map(normalizeCategoryName)
      .filter(Boolean)
      .filter((category) => availableCategories.includes(category) || category === GOOGLE_PHOTOS_CATEGORY)
  );

  return normalized.length > 0 ? normalized : [normalizeCategoryName(fallbackCategory)];
}

function matchesExcludedKeywords(excludedKeywords, photo) {
  if (!Array.isArray(excludedKeywords) || excludedKeywords.length === 0) {
    return false;
  }

  const haystacks = [
    photo?.title,
    photo?.author,
    photo?.category
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return excludedKeywords.some((keyword) => haystacks.includes(String(keyword).trim().toLowerCase()));
}

function filterVisiblePhotos(photos, excludedKeywords) {
  return (photos ?? []).filter((photo) =>
    photo &&
    photo.url &&
    photo.rating !== 1 &&
    !photo.isBroken &&
    !matchesExcludedKeywords(excludedKeywords, photo)
  );
}

function attachCategory(category, photo) {
  return photo.category === category ? { ...photo } : { ...photo, category };
}

function getCategoryPhotos(category, collections, externalCollections = {}) {
  return externalCollections[category] ?? collections[category] ?? [];
}

function uniqByUrl(photos) {
  /** @type {Set<string>} */
  const seen = new Set();
  return photos.filter((photo) => {
    if (!photo?.url || seen.has(photo.url)) {
      return false;
    }
    seen.add(photo.url);
    return true;
  });
}

function shuffleWithRng(list, rng = Math.random) {
  const shuffled = [...list];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function interleaveLists(lists) {
  if (lists.length === 0) {
    return [];
  }

  const maxLength = Math.max(...lists.map((list) => list.length));
  return Array.from({ length: maxLength }, (_, index) => index).reduce(
    (combined, index) => combined.concat(lists.map((list) => list[index % list.length])),
    []
  );
}

function buildBalancedFeed({ selectedCategories, collections, externalCollections = {}, excludedKeywords, rng = Math.random }) {
  const lists = selectedCategories
    .map((category) =>
      shuffleWithRng(
        filterVisiblePhotos(getCategoryPhotos(category, collections, externalCollections), excludedKeywords)
          .map((photo) => attachCategory(category, photo)),
        rng
      )
    )
    .filter((list) => list.length > 0);

  if (lists.length === 0) {
    return [];
  }

  if (lists.length === 1) {
    return uniqByUrl(lists[0]);
  }

  return uniqByUrl(interleaveLists(lists));
}

function findPhotoInFeed(photosList, url) {
  return (photosList ?? []).find((photo) => photo?.url === url) ?? null;
}

function getPhotoByUrl(collections, url, externalCollections = {}) {
  return [...Object.values(collections), ...Object.values(externalCollections)]
    .flat()
    .find((photo) => photo?.url === url) ?? null;
}

function updatePhotoInNamedCollections(collections, url, updater) {
  let updatedPhoto = null;
  let changed = false;

  const nextCollections = Object.fromEntries(
    Object.entries(collections).map(([category, photos]) => {
      const nextPhotos = (photos ?? []).map((photo) => {
        if (!photo || photo.url !== url) {
          return photo ? { ...photo } : photo;
        }

        const nextPhoto = updater({ ...photo, category: photo.category ?? category });
        updatedPhoto = nextPhoto;
        changed = true;
        return nextPhoto;
      });

      return [category, nextPhotos];
    })
  );

  return {
    collections: nextCollections,
    updatedPhoto,
    changed
  };
}

function updatePhotoInCollections(collections, url, updater) {
  return updatePhotoInNamedCollections(collections, url, updater);
}

function updatePhotoInLibraries(collections, externalCollections = {}, url, updater) {
  const updatedCollections = updatePhotoInNamedCollections(collections, url, updater);
  const updatedExternalCollections = updatePhotoInNamedCollections(externalCollections, url, updater);

  return {
    collections: updatedCollections.collections,
    externalCollections: updatedExternalCollections.collections,
    updatedPhoto: updatedExternalCollections.updatedPhoto ?? updatedCollections.updatedPhoto,
    changed: updatedCollections.changed || updatedExternalCollections.changed,
    changedInCollections: updatedCollections.changed,
    changedInExternalCollections: updatedExternalCollections.changed
  };
}

function isTimeInSchedule(currentTimeStr, startStr, endStr) {
  const [currentHour, currentMinute] = currentTimeStr.split(':').map(Number);
  const [startHour, startMinute] = startStr.split(':').map(Number);
  const [endHour, endMinute] = endStr.split(':').map(Number);

  const currentMinutes = currentHour * 60 + currentMinute;
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function formatTime(now) {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function inferOrientation(photo) {
  if (photo?.orientation === 'portrait' || photo?.orientation === 'landscape') {
    return photo.orientation;
  }

  if (typeof photo?.width === 'number' && typeof photo?.height === 'number') {
    return photo.height > photo.width ? 'portrait' : 'landscape';
  }

  return 'unknown';
}

function filterPhotosForTime(photos, now) {
  const currentTime = formatTime(now);
  return photos.filter((photo) =>
    !Array.isArray(photo.timeRanges) ||
    photo.timeRanges.length === 0 ||
    photo.timeRanges.some((timeRange) => isTimeInSchedule(currentTime, timeRange.start, timeRange.end))
  );
}

function filterPhotosForWeather(photos, alignWeather, physicalMatch, newsMatch, rng = Math.random) {
  if (!alignWeather) {
    return photos;
  }

  let candidates = [];

  if (physicalMatch === 'Snowy') {
    candidates = photos.filter((photo) => photo.isSnowy);
  } else if (physicalMatch === 'Rainy') {
    candidates = photos.filter((photo) => photo.isRain);
  } else if (newsMatch === 'Sunny') {
    candidates = photos.filter((photo) => photo.isSunny);
  } else if (newsMatch === 'Rainy') {
    candidates = photos.filter((photo) => photo.isRain || photo.isCloudy);
  } else {
    candidates = photos.filter((photo) => photo.isCloudy);
  }

  return candidates.length > 0 && rng() < 0.8 ? candidates : photos;
}

function filterPhotosForNight(photos, alignTimeOfDay, isNight, nightPercentage, rng = Math.random) {
  if (!alignTimeOfDay || !isNight) {
    return photos;
  }

  const nightPhotos = photos.filter((photo) => photo.isNight);
  return nightPhotos.length > 0 && rng() < ((nightPercentage ?? 50) / 100)
    ? nightPhotos
    : photos;
}

function selectWeightedRandomPhoto({ photos, currentPhotoUrl = null, excludedKeywords = [], rng = Math.random }) {
  const candidates = filterVisiblePhotos(photos, excludedKeywords);
  if (candidates.length === 0) {
    return null;
  }

  const withoutCurrent = currentPhotoUrl && candidates.length > 1
    ? candidates.filter((photo) => photo.url !== currentPhotoUrl)
    : candidates;

  const weightedCandidates = withoutCurrent.length > 0 ? withoutCurrent : candidates;

  const thresholdMap = weightedCandidates.reduce((accumulator, photo) => {
    const weight = (photo.rating ?? 10) / 10;
    const threshold = accumulator.total + weight;
    return {
      total: threshold,
      items: [...accumulator.items, { photo, threshold }]
    };
  }, { total: 0, items: /** @type {{ photo: Photo, threshold: number }[]} */ ([]) });

  if (thresholdMap.total === 0) {
    return weightedCandidates[0];
  }

  const target = rng() * thresholdMap.total;
  return thresholdMap.items.find((item) => item.threshold >= target)?.photo ?? weightedCandidates.at(-1);
}

function wrapIndex(length, index) {
  return ((index % length) + length) % length;
}

function getDirectionStep(direction = 'next') {
  return direction === 'prev' ? -1 : 1;
}

function findPhotoIndexByUrl(photos, url) {
  return (photos ?? []).findIndex((photo) => photo?.url === url);
}

function getSequenceFallbackIndex(direction, photos) {
  return direction === 'prev' ? photos.length - 1 : 0;
}

function selectSequentialPhoto({ state, direction = 'next' }) {
  const photos = filterVisiblePhotos(state.library.photosList, state.config.excludedKeywords);
  if (photos.length === 0) {
    return null;
  }

  const currentIndex = findPhotoIndexByUrl(photos, state.playback.activePhotoUrl);
  const nextIndex = currentIndex === -1
    ? getSequenceFallbackIndex(direction, photos)
    : wrapIndex(photos.length, currentIndex + getDirectionStep(direction));

  return photos[nextIndex] ?? null;
}

function selectSmartPhoto({ state, direction = 'next', now = new Date(), rng = Math.random }) {
  const basePhotos = filterPhotosForNight(
    filterPhotosForWeather(
      filterPhotosForTime(state.library.photosList, now),
      state.config.alignWeather,
      String(state.runtime.physicalWeather?.weatherMatch ?? 'Cloudy'),
      String(state.runtime.newsSentiment?.weatherMatch ?? 'Cloudy'),
      rng
    ),
    state.config.alignTimeOfDay,
    state.runtime.weather?.current
      ? state.runtime.weather.current.is_day === 0
      : now.getHours() >= 18 || now.getHours() < 6,
    state.config.nightPercentage,
    rng
  );

  return selectWeightedRandomPhoto({
    photos: basePhotos,
    currentPhotoUrl: direction === 'prev' ? null : state.playback.activePhotoUrl,
    excludedKeywords: state.config.excludedKeywords,
    rng
  });
}

function hashString(value) {
  return Array.from(String(value)).reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7);
}

function pickStablePhoto(candidates, seed) {
  if (candidates.length === 0) {
    return null;
  }

  const sortedCandidates = [...candidates].sort((left, right) => left.url.localeCompare(right.url));
  return sortedCandidates[hashString(seed) % sortedCandidates.length];
}

function getActivePhoto(state) {
  return state.playback.activePhotoUrl
    ? findPhotoInFeed(state.library.photosList, state.playback.activePhotoUrl)
      ?? getPhotoByUrl(state.library.collections, state.playback.activePhotoUrl, state.library.externalCollections)
    : null;
}

function deriveCurrentFrame(state) {
  const primary = getActivePhoto(state);
  const orientation = primary ? inferOrientation(primary) : 'unknown';
  const splitEligible = Boolean(
    primary &&
    state.config.splitPortrait &&
    orientation === 'portrait' &&
    primary.preventPairing !== true
  );

  const secondaryCandidates = splitEligible
    ? state.library.photosList.filter((photo) =>
        photo.url !== primary?.url &&
        photo.preventPairing !== true &&
        inferOrientation(photo) === 'portrait' &&
        (!primary?.category || photo.category === primary.category)
      )
    : [];

  const secondary = splitEligible
    ? pickStablePhoto(secondaryCandidates, `${primary?.url ?? 'none'}:${state.playback.splitSeed}`)
    : null;

  return {
    primary,
    secondary,
    layout: secondary ? 'split' : 'single',
    crop: {
      primaryPercent: primary?.cropPercent ?? null,
      primaryPositionY: primary?.cropPositionY ?? null,
      secondaryPercent: secondary?.cropPercent ?? state.config.splitCropPercent ?? DEFAULT_SPLIT_CROP,
      secondaryPositionY: secondary?.cropPositionY ?? null
    },
    context: {
      category: primary?.category ?? null,
      categories: [...state.playback.selectedCategories],
      photoCount: state.library.photosList.length,
      orientation: /** @type {PhotoOrientation} */ (orientation),
      splitEligible
    }
  };
}

module.exports = {
  DEFAULT_SPLIT_CROP,
  buildBalancedFeed,
  deriveCurrentFrame,
  filterPhotosForNight,
  filterPhotosForTime,
  filterPhotosForWeather,
  filterVisiblePhotos,
  findPhotoInFeed,
  getActivePhoto,
  getPhotoByUrl,
  inferOrientation,
  interleaveLists,
  isTimeInSchedule,
  matchesExcludedKeywords,
  normalizeCategoryName,
  normalizeCategorySelection,
  selectSequentialPhoto,
  selectSmartPhoto,
  selectWeightedRandomPhoto,
  shuffleWithRng,
  updatePhotoInCollections,
  updatePhotoInLibraries,
  uniqByUrl
};
