// @ts-check

/**
 * @typedef {import('./types').CollectionsState} CollectionsState
 * @typedef {import('./types').CurrentFrame} CurrentFrame
 * @typedef {import('./types').DomainState} DomainState
 * @typedef {import('./types').Photo} Photo
 * @typedef {import('./types').PhotoOrientation} PhotoOrientation
 * @typedef {() => number} RandomSource Conventionally [0, 1); no input validation.
 * @typedef {'next' | 'prev'} Direction Only exact 'prev' reverses traversal.
 * @typedef {(photo: Photo) => Photo} PhotoUpdater Receives a shallow copy; caller owns callback purity.
 * @typedef {{ collections: CollectionsState, updatedPhoto: Photo | null, changed: boolean }} CollectionUpdate
 * @typedef {CollectionUpdate & { externalCollections: CollectionsState, changedInCollections: boolean, changedInExternalCollections: boolean }} LibraryUpdate
 */

/**
 * Options keep the existing data-first interfaces. Parameter defaults apply to undefined,
 * not null/falsy values (unlike ReducerEnvironment); injected callbacks/errors
 * are used verbatim. Stable inputs and replayable RNGs make selection replayable.
 * No selector performs I/O or updates playback cursors. Ambient Date/Math.random
 * defaults and caller-provided accessors/updaters are not pure computations.
 *
 * @typedef {object} BalancedFeedOptions
 * @property {ReadonlyArray<string>} selectedCategories
 * @property {Readonly<CollectionsState>} collections
 * @property {Readonly<CollectionsState>} [externalCollections={}]
 * @property {unknown} [excludedKeywords]
 * @property {RandomSource} [rng=Math.random]
 *
 * @typedef {object} WeightedPhotoOptions
 * @property {ReadonlyArray<Photo> | null | undefined} photos
 * @property {string | null} [currentPhotoUrl=null]
 * @property {unknown} [excludedKeywords=[]]
 * @property {RandomSource} [rng=Math.random]
 *
 * @typedef {object} SmartPreferences
 * @property {string | null} [previousCategory=null]
 * @property {Direction} [direction='next']
 * @property {boolean} [alignWeather=false]
 * @property {string} [physicalMatch='Cloudy']
 * @property {string} [newsMatch='Cloudy']
 * @property {boolean} [alignTimeOfDay=false]
 * @property {boolean} [isNight=false]
 * @property {number | null} [nightPercentage=50]
 * @property {Date} [now] Fresh Date by default; local hours/minutes, not a clock callback.
 * @typedef {WeightedPhotoOptions & SmartPreferences} SmartFeedOptions
 * @typedef {{ state: DomainState, direction?: Direction }} SequentialPhotoOptions
 * @typedef {SequentialPhotoOptions & { now?: Date, rng?: RandomSource }} SmartPhotoOptions
 */

const DEFAULT_SPLIT_CROP = 50;
const GOOGLE_PHOTOS_CATEGORY = 'Google Photos';

const CATEGORY_ALIASES = Object.freeze({
  'Liminal Space': 'Liminal Spaces',
  'Liminal Spaces': 'Liminal Spaces',
  'AI Creation': 'AI Creations',
  'AI Creations': 'AI Creations'
});

/** @param {unknown} name @returns {string} Trim then canonicalize known aliases. */
function normalizeCategoryName(name) {
  const cleanName = String(name ?? '').trim();
  return CATEGORY_ALIASES[cleanName] ?? cleanName;
}

function uniqueStrings(values) {
  return [...new Set(values)];
}

/**
 * Ordered unique names; Google Photos is allowed even outside the catalog.
 * Empty/invalid selection uses the normalized fallback without revalidation.
 * @param {unknown} input Array or comma-separated native string coercion.
 * @param {ReadonlyArray<string>} availableCategories
 * @param {unknown} [fallbackCategory] First available name, else Scenic Nature.
 * @returns {string[]}
 */
function normalizeCategorySelection(input, availableCategories, fallbackCategory = availableCategories[0] ?? 'Scenic Nature') {
  const normalized = uniqueStrings(
    (Array.isArray(input) ? input : String(input ?? '').split(','))
      .map(normalizeCategoryName)
      .filter(Boolean)
      .filter((category) => availableCategories.includes(category) || category === GOOGLE_PHOTOS_CATEGORY)
  );

  return normalized.length > 0 ? normalized : [normalizeCategoryName(fallbackCategory)];
}

/**
 * Native case-insensitive substring matching; a blank term matches any text.
 * @param {unknown} excludedKeywords Only arrays enable matching; terms are string-coerced.
 * @param {Photo | null | undefined} photo
 * @returns {boolean}
 */
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

/**
 * Fresh array, original row aliases; excludes missing URLs, exact rating 1,
 * truthy broken flags and keyword matches. Does not deduplicate or apply time.
 * @param {ReadonlyArray<Photo | null | undefined> | null | undefined} photos
 * @param {unknown} [excludedKeywords]
 * @returns {Photo[]}
 */
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

/**
 * First truthy exact URL wins; fresh ordered array, unchanged row aliases.
 * @template {Photo} T
 * @param {ReadonlyArray<T | null | undefined>} photos
 * @returns {T[]}
 */
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

function groupPhotosByCategory(photos) {
  const pools = new Map();

  photos.forEach((photo) => {
    const category = photo.category ?? '';
    const pool = pools.get(category) ?? [];
    pool.push(photo);
    pools.set(category, pool);
  });

  return [...pools.entries()].map(([category, poolPhotos]) => ({ category, photos: poolPhotos }));
}

/**
 * Fisher-Yates on a shallow copy, max(n-1, 0) draws; never mutates the input list.
 * @template T
 * @param {ReadonlyArray<T>} list
 * @param {RandomSource} [rng=Math.random]
 * @returns {T[]}
 */
function shuffleWithRng(list, rng = Math.random) {
  const shuffled = [...list];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

/**
 * Cycles each list to the longest length; preserves aliases/duplicates, no
 * deduplication. Callers filter empty lists; an empty inner list yields undefined.
 * @template T
 * @param {ReadonlyArray<ReadonlyArray<T>>} lists
 * @returns {Array<T | undefined>}
 */
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

/**
 * External pools override same-name curated pools (even when empty). Filter,
 * shallow-copy/tag, shuffle, interleave, then first-URL dedupe. Feed ordering
 * alone is not an equal-playback guarantee; selectors rotate eligible pools.
 * @param {BalancedFeedOptions} options
 * @returns {Photo[]} Fresh rows/array; nested metadata remains shared.
 */
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

/**
 * @param {ReadonlyArray<Photo | null | undefined> | null | undefined} photosList
 * @param {string | null | undefined} url Strict equality; no visibility filtering.
 * @returns {Photo | null} First row alias or null.
 */
function findPhotoInFeed(photosList, url) {
  return (photosList ?? []).find((photo) => photo?.url === url) ?? null;
}

/**
 * @param {Readonly<CollectionsState>} collections Curated pools searched first.
 * @param {string | null | undefined} url Strict equality; no visibility filtering.
 * @param {Readonly<CollectionsState>} [externalCollections={}]
 * @returns {Photo | null} First row alias or null.
 */
function getPhotoByUrl(collections, url, externalCollections = {}) {
  return [...Object.values(collections), ...Object.values(externalCollections)]
    .flat()
    .find((photo) => photo?.url === url) ?? null;
}

function shallowEqualRecords(left, right) {
  if (left === right) {
    return true;
  }

  const leftKeys = Object.keys(left || {});
  const rightKeys = Object.keys(right || {});

  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => left[key] === right[key]);
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
        const photoChanged = !shallowEqualRecords(nextPhoto, photo);

        updatedPhoto = photoChanged ? nextPhoto : photo;
        changed = changed || photoChanged;

        return photoChanged ? nextPhoto : { ...photo };
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

/**
 * Maps all exact matches, adding a missing category before calling the updater.
 * Rebuilds maps/lists and shallow-copies truthy rows even on no-op/miss. Change
 * detection is shallow !==; updatedPhoto is the last match (original if equal).
 * @param {CollectionsState} collections
 * @param {string} url
 * @param {PhotoUpdater} updater
 * @returns {CollectionUpdate}
 */
function updatePhotoInCollections(collections, url, updater) {
  return updatePhotoInNamedCollections(collections, url, updater);
}

/**
 * Curated then external updates; external last-match result wins even when
 * unchanged. Flags combine both maps. Callback failures propagate without a
 * result; callback side effects are not rolled back. Nested aliases are shared.
 * @param {CollectionsState} collections
 * @param {CollectionsState} [externalCollections={}]
 * @param {string} url
 * @param {PhotoUpdater} updater
 * @returns {LibraryUpdate}
 */
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

/**
 * Local HH:MM comparison, inclusive start/exclusive end; overnight wraps.
 * Equal endpoints form an empty range; no validation/coercion beyond Number.
 * @param {string} currentTimeStr
 * @param {string} startStr
 * @param {string} endStr
 * @returns {boolean}
 */
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

/**
 * Explicit portrait/landscape, else numeric dimensions (square is landscape).
 * @param {Photo | null | undefined} photo
 * @returns {PhotoOrientation}
 */
function inferOrientation(photo) {
  if (photo?.orientation === 'portrait' || photo?.orientation === 'landscape') {
    return photo.orientation;
  }

  if (typeof photo?.width === 'number' && typeof photo?.height === 'number') {
    return photo.height > photo.width ? 'portrait' : 'landscape';
  }

  return 'unknown';
}

/**
 * Fresh array of original rows. Missing/empty ranges allow a row; any matching
 * range permits it. Reads local time even for empty input; non-Date inputs may throw.
 * @param {ReadonlyArray<Photo>} photos
 * @param {Date} now
 * @returns {Photo[]}
 */
function filterPhotosForTime(photos, now) {
  const currentTime = formatTime(now);
  return photos.filter((photo) =>
    !Array.isArray(photo.timeRanges) ||
    photo.timeRanges.length === 0 ||
    photo.timeRanges.some((timeRange) => isTimeInSchedule(currentTime, timeRange.start, timeRange.end))
  );
}

/**
 * Snow/rain physical priority, then news sunny/rain/cloudy. Strict <0.8 preference
 * only when matching rows exist; disabled/miss/rejected preference retains array.
 * @param {ReadonlyArray<Photo>} photos
 * @param {boolean} alignWeather
 * @param {string} physicalMatch
 * @param {string} newsMatch
 * @param {RandomSource} [rng=Math.random]
 * @returns {ReadonlyArray<Photo>}
 */
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

/**
 * Strict percentage threshold, nullish 50 fallback, no clamping. Disabled,
 * daytime, no match or rejected preference retains the original array identity.
 * @param {ReadonlyArray<Photo>} photos
 * @param {boolean} alignTimeOfDay
 * @param {boolean} isNight
 * @param {number | null | undefined} nightPercentage
 * @param {RandomSource} [rng=Math.random]
 * @returns {ReadonlyArray<Photo>}
 */
function filterPhotosForNight(photos, alignTimeOfDay, isNight, nightPercentage, rng = Math.random) {
  if (!alignTimeOfDay || !isNight) {
    return photos;
  }

  const nightPhotos = photos.filter((photo) => photo.isNight);
  return nightPhotos.length > 0 && rng() < ((nightPercentage ?? 50) / 100)
    ? nightPhotos
    : photos;
}

/**
 * Choose a visible pool uniformly first, then rate-weight within it, avoiding
 * current URL when alternatives exist. Zero total selects first without a draw;
 * cumulative thresholds use >=. No time filter or cursor mutation here.
 * @param {WeightedPhotoOptions} options
 * @returns {Photo | null} Original row alias; null when no visible candidates.
 */
function selectWeightedRandomPhoto({ photos, currentPhotoUrl = null, excludedKeywords = [], rng = Math.random }) {
  const candidates = filterVisiblePhotos(photos, excludedKeywords);
  if (candidates.length === 0) {
    return null;
  }

  const pools = groupPhotosByCategory(candidates);
  const pool = pools.length === 1
    ? pools[0]
    : pools[Math.min(Math.floor(rng() * pools.length), pools.length - 1)];
  const poolCandidates = pool.photos;
  const withoutCurrent = currentPhotoUrl && poolCandidates.length > 1
    ? poolCandidates.filter((photo) => photo.url !== currentPhotoUrl)
    : poolCandidates;

  const weightedCandidates = withoutCurrent.length > 0 ? withoutCurrent : poolCandidates;

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

/**
 * Visibility/time eligibility precede pool rotation (or initial random pool).
 * Weather/night preferences and rating weights apply only within that pool.
 * @param {SmartFeedOptions} options
 * @returns {Photo | null} Original row alias; null when no eligible pool remains.
 */
function selectSmartPhotoFromFeed({
  photos,
  currentPhotoUrl = null,
  previousCategory = null,
  direction = 'next',
  excludedKeywords = [],
  alignWeather = false,
  physicalMatch = 'Cloudy',
  newsMatch = 'Cloudy',
  alignTimeOfDay = false,
  isNight = false,
  nightPercentage = 50,
  now = new Date(),
  rng = Math.random
}) {
  const visiblePhotos = filterVisiblePhotos(photos, excludedKeywords);
  const pools = groupPhotosByCategory(filterPhotosForTime(visiblePhotos, now));
  if (pools.length === 0) {
    return null;
  }

  const previousPoolIndex = pools.findIndex((pool) => pool.category === previousCategory);
  const pool = pools.length === 1
    ? pools[0]
    : previousPoolIndex !== -1
      ? pools[wrapIndex(pools.length, previousPoolIndex + getDirectionStep(direction))]
      : pools[Math.min(Math.floor(rng() * pools.length), pools.length - 1)];
  const candidates = filterPhotosForNight(
    filterPhotosForWeather(pool.photos, alignWeather, physicalMatch, newsMatch, rng),
    alignTimeOfDay,
    isNight,
    nightPercentage,
    rng
  );

  return selectWeightedRandomPhoto({
    photos: candidates,
    currentPhotoUrl,
    rng
  });
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

/**
 * Visible pools round-robin using per-pool cursors; one pool walks feed order.
 * Does not apply schedules/weather, draw randomness, or advance stored cursors.
 * @param {SequentialPhotoOptions} options
 * @returns {Photo | null} Original row alias, or null for an empty visible feed.
 */
function selectSequentialPhoto({ state, direction = 'next' }) {
  const photos = filterVisiblePhotos(state.library.photosList, state.config.excludedKeywords);
  if (photos.length === 0) {
    return null;
  }

  const pools = groupPhotosByCategory(photos);
  if (pools.length > 1) {
    const currentPhoto = photos.find((photo) => photo.url === state.playback.activePhotoUrl);
    const currentPoolIndex = pools.findIndex((pool) => pool.category === (currentPhoto?.category ?? ''));
    const step = getDirectionStep(direction);
    const targetPoolIndex = currentPoolIndex === -1
      ? (direction === 'prev' ? pools.length - 1 : 0)
      : wrapIndex(pools.length, currentPoolIndex + step);
    const targetPool = pools[targetPoolIndex];
    const cursor = state.playback.poolSequenceCursors?.[targetPool.category] ?? 0;
    const targetPhotoIndex = direction === 'prev'
      ? wrapIndex(targetPool.photos.length, cursor - 1)
      : wrapIndex(targetPool.photos.length, cursor);

    return targetPool.photos[targetPhotoIndex] ?? null;
  }

  const currentIndex = findPhotoIndexByUrl(photos, state.playback.activePhotoUrl);
  const nextIndex = currentIndex === -1
    ? getSequenceFallbackIndex(direction, photos)
    : wrapIndex(photos.length, currentIndex + getDirectionStep(direction));

  return photos[nextIndex] ?? null;
}

/**
 * State adapter for smart selection; prev allows reselecting current URL.
 * Weather is_day takes precedence over local-hour night classification.
 * @param {SmartPhotoOptions} options
 * @returns {Photo | null}
 */
function selectSmartPhoto({ state, direction = 'next', now = new Date(), rng = Math.random }) {
  const currentPhoto = state.library.photosList.find((photo) =>
    photo.url === state.playback.activePhotoUrl
  );

  return selectSmartPhotoFromFeed({
    photos: state.library.photosList,
    currentPhotoUrl: direction === 'prev' ? null : state.playback.activePhotoUrl,
    previousCategory: currentPhoto?.category ?? null,
    direction,
    excludedKeywords: state.config.excludedKeywords,
    alignWeather: state.config.alignWeather,
    physicalMatch: String(state.runtime.physicalWeather?.weatherMatch ?? 'Cloudy'),
    newsMatch: String(state.runtime.newsSentiment?.weatherMatch ?? 'Cloudy'),
    alignTimeOfDay: state.config.alignTimeOfDay,
    isNight: state.runtime.weather?.current
      ? state.runtime.weather.current.is_day === 0
      : now.getHours() >= 18 || now.getHours() < 6,
    nightPercentage: state.config.nightPercentage,
    now,
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

/**
 * Feed-first lookup, then curated/external libraries; no visibility filtering.
 * @param {DomainState} state
 * @returns {Photo | null} Original alias; falsy/missing active URL yields null.
 */
function getActivePhoto(state) {
  return state.playback.activePhotoUrl
    ? findPhotoInFeed(state.library.photosList, state.playback.activePhotoUrl)
      ?? getPhotoByUrl(state.library.collections, state.playback.activePhotoUrl, state.library.externalCollections)
    : null;
}

/**
 * Fresh frame/crop/context and detached category array; photo aliases retained.
 * Pairing is stable by URL/seed and same-category portrait eligibility, without
 * RNG/time/visibility filtering. Crop defaults use ?? (explicit zero survives).
 * @param {DomainState} state
 * @returns {CurrentFrame}
 */
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
  selectSmartPhotoFromFeed,
  selectWeightedRandomPhoto,
  shuffleWithRng,
  updatePhotoInCollections,
  updatePhotoInLibraries,
  uniqByUrl
};
