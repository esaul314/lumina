// @ts-check

/** @typedef {string[]} CategorySelection */

/**
 * The browser accepts canonical and legacy category locations while snapshots
 * converge on playback.selectedCategories.
 *
 * @typedef {Record<string, unknown> & {
 *   playback?: {selectedCategories?: unknown}|null,
 *   currentFrame?: {context?: {categories?: unknown}|null}|null,
 *   currentCategory?: unknown
 * }} ClientCategorySnapshot
 */

/** @param {unknown} value @returns {string} */
const trim = (value) => String(value ?? '').trim();

/** @param {...(value: unknown) => unknown} fns @returns {(value: unknown) => unknown} */
const pipe = (...fns) => (value) => fns.reduce((result, fn) => fn(result), value);

/** @param {string[]} values @returns {string[]} */
const unique = (values) => [...new Set(values)];

/** @param {unknown} value @returns {unknown[]} */
const splitCategories = (value) => (Array.isArray(value) ? value : String(value ?? '').split(','));

/** @type {Readonly<Record<string, string>>} */
const CATEGORY_ALIASES = Object.freeze({
  'Liminal Space': 'Liminal Spaces',
  'Liminal Spaces': 'Liminal Spaces',
  'AI Creation': 'AI Creations',
  'AI Creations': 'AI Creations'
});

/** @param {unknown} value @returns {string} */
export const normalizeCategoryName = (value) => CATEGORY_ALIASES[trim(value)] ?? trim(value);

/** @param {unknown[]} values @returns {CategorySelection} */
const compactStrings = (values) => values.map(normalizeCategoryName).filter(Boolean);

/** @param {unknown} value @returns {boolean} */
const hasValues = (value) => (Array.isArray(value) ? value.length > 0 : Boolean(trim(value)));

/** @param {unknown[]} values @returns {unknown} */
const firstDefined = (values) => values.find(hasValues);

/** @param {ClientCategorySnapshot|null|undefined} snapshot @returns {unknown[]} */
const selectionSources = (snapshot) => [
  snapshot?.playback?.selectedCategories,
  snapshot?.currentFrame?.context?.categories,
  snapshot?.currentCategory
];

/** @param {unknown} value @returns {CategorySelection} */
export const normalizeCategorySelection = pipe(splitCategories, compactStrings, unique);

/** @param {unknown} value @returns {string} */
export const serializeCategorySelection = pipe(normalizeCategorySelection, (values) => values.join(','));

/** @param {ClientCategorySnapshot|null|undefined} snapshot @returns {CategorySelection} */
export const getSelectedCategories = (snapshot) => normalizeCategorySelection(firstDefined(selectionSources(snapshot)));

/** @param {ClientCategorySnapshot|null|undefined} snapshot @param {unknown} category @returns {boolean} */
export const isCategorySelected = (snapshot, category) => (
  getSelectedCategories(snapshot).includes(normalizeCategoryName(category))
);

/** @param {unknown} selection @returns {CategorySelection} */
const resolveSelection = (selection) => (
  selection && typeof selection === 'object' && !Array.isArray(selection)
    ? getSelectedCategories(selection)
    : normalizeCategorySelection(selection)
);

/**
 * Toggle one canonical category while preserving the existing non-empty
 * selection invariant.
 *
 * @param {unknown} category
 * @param {unknown} selection
 * @returns {CategorySelection}
 */
export const toggleCategorySelection = (category, selection) => {
  const nextCategory = normalizeCategoryName(category);
  const normalizedSelection = resolveSelection(selection);

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
