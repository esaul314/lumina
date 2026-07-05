import { normalizeSnapshot } from './frameSelectors.js';
import {
  getSelectedCategories,
  isCategorySelected,
  normalizeCategorySelection,
  serializeCategorySelection,
  toggleCategorySelection
} from './categorySelection.js';

const trim = (value) => String(value ?? '').trim();
const identity = (value) => value;

const updateSnapshotSlice = (snapshot, key, updater = identity) => (
  snapshot?.[key] ? { ...snapshot[key], ...updater(snapshot[key]) } : snapshot?.[key]
);

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

const mergeFeedSourceConfig = (feedConfigs, source, configPatch) => ({
  ...(feedConfigs || {}),
  [source]: {
    ...((feedConfigs || {})[source] || {}),
    ...(configPatch || {})
  }
});

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
