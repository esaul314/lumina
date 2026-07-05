import { normalizeSnapshot } from './frameSelectors.js';

const trim = (value) => String(value ?? '').trim();
const identity = (value) => value;
const pipe = (...fns) => (value) => fns.reduce((result, fn) => fn(result), value);
const unique = (values) => [...new Set(values)];
const splitCategories = (value) => (Array.isArray(value) ? value : String(value ?? '').split(','));
const compactStrings = (values) => values.map(trim).filter(Boolean);

export const normalizeCategorySelection = pipe(splitCategories, compactStrings, unique);
export const serializeCategorySelection = pipe(normalizeCategorySelection, (values) => values.join(','));

export const toggleCategorySelection = (category, selection) => {
  const nextCategory = trim(category);
  const normalizedSelection = normalizeCategorySelection(selection);

  if (!nextCategory) {
    return normalizedSelection;
  }

  if (normalizedSelection.includes(nextCategory)) {
    return normalizedSelection.length > 1
      ? normalizedSelection.filter((value) => value !== nextCategory)
      : normalizedSelection;
  }

  return [...normalizedSelection, nextCategory];
};

const updateSnapshotSlice = (snapshot, key, updater = identity) => (
  snapshot?.[key] ? { ...snapshot[key], ...updater(snapshot[key]) } : snapshot?.[key]
);

export function applyCategorySelection(snapshot, selection) {
  if (!snapshot) {
    return snapshot;
  }

  const categories = normalizeCategorySelection(selection);
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
