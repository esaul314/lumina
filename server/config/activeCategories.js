// @ts-check

const fs = require('fs');
const { normalizeCategorySelection } = require('../domain/selectors.js');

/**
 * Decode a persisted category choice against the collections available now.
 * Missing, stale, or malformed choices fall back to the configured default.
 *
 * @param {unknown} value
 * @param {string[]} availableCategories
 * @param {string} fallbackCategory
 * @returns {string[]}
 */
const normalizeActiveCategories = (value, availableCategories, fallbackCategory) => {
  const categories = value && typeof value === 'object' && !Array.isArray(value)
    ? value.categories
    : value;
  return normalizeCategorySelection(categories, availableCategories, fallbackCategory);
};

/**
 * Read the saved selection, leaving file and warning effects at this boundary.
 *
 * @param {{path: string, availableCategories: string[], fallbackCategory: string, fsImpl?: typeof fs, log?: Pick<Console, 'warn'>}} options
 * @returns {string[]}
 */
function loadActiveCategories({ path, availableCategories, fallbackCategory, fsImpl = fs, log = console }) {
  if (!fsImpl.existsSync(path)) {
    return [fallbackCategory];
  }

  try {
    return normalizeActiveCategories(
      JSON.parse(fsImpl.readFileSync(path, 'utf8')),
      availableCategories,
      fallbackCategory
    );
  } catch (error) {
    log.warn('[Active Categories] Could not restore saved selection:', error.message);
    return [fallbackCategory];
  }
}

/**
 * Persist a detached selection with an atomic same-directory rename.
 *
 * @param {{path: string, categories: string[], fsImpl?: typeof fs}} options
 * @returns {void}
 */
function saveActiveCategories({ path, categories, fsImpl = fs }) {
  const temporaryPath = `${path}.tmp`;
  fsImpl.writeFileSync(temporaryPath, `${JSON.stringify({ categories: [...categories] }, null, 2)}\n`, 'utf8');
  fsImpl.renameSync(temporaryPath, path);
}

/**
 * Persist only explicit category-selection commands after their dispatch has
 * completed. Scheduler and other internal callers can keep using the original
 * dispatcher, so scheduled activations never become the restart baseline.
 *
 * @param {{dispatchCommand: (command: any, env?: Record<string, unknown>) => Promise<unknown>, getCategories: () => string[], save: (categories: string[]) => void}} dependencies
 * @returns {(command: any, env?: Record<string, unknown>) => Promise<unknown>}
 */
const createActiveCategoryDispatcher = ({ dispatchCommand, getCategories, save }) => async (command, env) => {
  const result = await dispatchCommand(command, env);
  if (command?.type === 'select-categories') {
    save(getCategories());
  }
  return result;
};

module.exports = {
  createActiveCategoryDispatcher,
  loadActiveCategories,
  normalizeActiveCategories,
  saveActiveCategories
};
