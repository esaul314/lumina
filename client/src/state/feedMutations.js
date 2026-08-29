// @ts-check

import { normalizeSnapshot } from './frameSelectors.js';
import {
  getSelectedCategories,
  isCategorySelected,
  normalizeCategorySelection,
  serializeCategorySelection,
  toggleCategorySelection
} from './categorySelection.js';

/** @typedef {Record<string, Record<string, Record<string, unknown>|undefined>|undefined>} FeedConfigs */
/** @typedef {{selectedCategories?: string[], [key: string]: unknown}} PlaybackSlice */
/** @typedef {{categories?: string[], [key: string]: unknown}} FrameContext */
/** @typedef {{context?: FrameContext|null, [key: string]: unknown}} MutationFrame */
/** @typedef {{feedConfigs?: FeedConfigs|null, [key: string]: unknown}} SnapshotConfig */

/**
 * The mutation helpers accept the normalized browser snapshot plus the
 * legacy aliases that the server still returns. The shape is intentionally
 * client-owned so a later TypeScript migration does not import server types.
 *
 * @typedef {Record<string, unknown> & {
 *   currentCategory?: string,
 *   playback?: PlaybackSlice|null,
 *   currentFrame?: MutationFrame|null,
 *   feedConfigs?: FeedConfigs|null,
 *   config?: SnapshotConfig|null
 * }} ClientMutationSnapshot
 */

/** @param {unknown} value @returns {string} */
const trim = (value) => String(value ?? '').trim();
/** @template T @param {T} value @returns {T} */
const identity = (value) => value;

/**
 * Update one optional snapshot slice without mutating the source snapshot.
 *
 * @param {ClientMutationSnapshot|null|undefined} snapshot
 * @param {string} key
 * @param {(slice: Record<string, unknown>) => Record<string, unknown>} [updater]
 * @returns {unknown}
 */
const updateSnapshotSlice = (snapshot, key, updater = identity) => (
  snapshot?.[key]
    ? {
        ...snapshot[key],
        ...updater(/** @type {Record<string, unknown>} */ (snapshot[key]))
      }
    : snapshot?.[key]
);

/**
 * Project a category selection into the canonical snapshot aliases.
 *
 * @param {ClientMutationSnapshot|null|undefined} snapshot
 * @param {unknown} selection
 * @returns {ClientMutationSnapshot|null|undefined}
 */
export function applyCategorySelection(snapshot, selection) {
  if (!snapshot) {
    return snapshot;
  }

  const categories = normalizeCategorySelection(
    selection && typeof selection === 'object' && !Array.isArray(selection)
      ? getSelectedCategories(selection)
      : selection
  );
  const currentCategory = categories.join(',');

  return normalizeSnapshot({
    ...snapshot,
    currentCategory,
    playback: updateSnapshotSlice(snapshot, 'playback', () => ({
      selectedCategories: categories
    })),
    currentFrame: snapshot.currentFrame
      ? {
          ...snapshot.currentFrame,
          context: {
            ...snapshot.currentFrame.context,
            categories
          }
        }
      : snapshot.currentFrame
  });
}

export {
  getSelectedCategories,
  isCategorySelected,
  normalizeCategorySelection,
  serializeCategorySelection,
  toggleCategorySelection
};

/**
 * Merge one source patch into a category's feed configuration.
 *
 * @param {FeedConfigs|null|undefined} feedConfigs
 * @param {string} source
 * @param {Record<string, unknown>|null|undefined} configPatch
 * @returns {FeedConfigs}
 */
const mergeFeedSourceConfig = (feedConfigs, source, configPatch) => ({
  ...(feedConfigs || {}),
  [source]: {
    ...((feedConfigs || {})[source] || {}),
    ...(configPatch || {})
  }
});

/**
 * Project a feed-source edit into both canonical and legacy snapshot paths.
 * Invalid boundary inputs are identity-preserving no-ops.
 *
 * @param {ClientMutationSnapshot|null|undefined} snapshot
 * @param {unknown} category
 * @param {unknown} source
 * @param {unknown} configPatch
 * @returns {ClientMutationSnapshot|null|undefined}
 */
export function applyFeedSourceConfigPatch(snapshot, category, source, configPatch) {
  if (!snapshot || !trim(category) || !trim(source) || !configPatch || typeof configPatch !== 'object') {
    return snapshot;
  }

  const nextCategory = trim(category);
  const nextSource = trim(source);
  const nextFeedConfigs = {
    ...(snapshot.feedConfigs || {}),
    [nextCategory]: mergeFeedSourceConfig(snapshot.feedConfigs?.[nextCategory], nextSource, configPatch)
  };

  return normalizeSnapshot({
    ...snapshot,
    feedConfigs: nextFeedConfigs,
    config: updateSnapshotSlice(snapshot, 'config', (config) => ({
      feedConfigs: {
        ...(config.feedConfigs || {}),
        [nextCategory]: mergeFeedSourceConfig(config.feedConfigs?.[nextCategory], nextSource, configPatch)
      }
    }))
  });
}
