const trim = (value) => String(value ?? '').trim();
const pipe = (...fns) => (value) => fns.reduce((result, fn) => fn(result), value);
const unique = (values) => [...new Set(values)];
const splitCategories = (value) => (Array.isArray(value) ? value : String(value ?? '').split(','));

const CATEGORY_ALIASES = Object.freeze({
  'Liminal Space': 'Liminal Spaces',
  'Liminal Spaces': 'Liminal Spaces',
  'AI Creation': 'AI Creations',
  'AI Creations': 'AI Creations'
});

export const normalizeCategoryName = (value) => CATEGORY_ALIASES[trim(value)] ?? trim(value);

const compactStrings = (values) => values.map(normalizeCategoryName).filter(Boolean);
const hasValues = (value) => (Array.isArray(value) ? value.length > 0 : Boolean(trim(value)));
const firstDefined = (values) => values.find(hasValues);
const selectionSources = (snapshot) => [
  snapshot?.playback?.selectedCategories,
  snapshot?.currentFrame?.context?.categories,
  snapshot?.currentCategory
];

export const normalizeCategorySelection = pipe(splitCategories, compactStrings, unique);
export const serializeCategorySelection = pipe(normalizeCategorySelection, (values) => values.join(','));
export const getSelectedCategories = (snapshot) => normalizeCategorySelection(firstDefined(selectionSources(snapshot)));
export const isCategorySelected = (snapshot, category) => (
  getSelectedCategories(snapshot).includes(normalizeCategoryName(category))
);

const resolveSelection = (selection) => (
  selection && typeof selection === 'object' && !Array.isArray(selection)
    ? getSelectedCategories(selection)
    : normalizeCategorySelection(selection)
);

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
