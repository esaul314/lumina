// @ts-check

/** @typedef {{name?: unknown, usablePhotosCount?: unknown}|null|undefined} PoolResponse */

/**
 * Keep only valid usable-photo counts from the `/api/pools` response.
 *
 * @param {unknown} response
 * @returns {Record<string, number>}
 */
export const buildUsablePhotoCounts = (response) => {
  if (!Array.isArray(response)) return {};

  return Object.fromEntries(response.flatMap((/** @type {PoolResponse} */ pool) => {
    if (
      !pool
      || typeof pool.name !== 'string'
      || typeof pool.usablePhotosCount !== 'number'
      || !Number.isInteger(pool.usablePhotosCount)
      || pool.usablePhotosCount < 0
    ) {
      return [];
    }

    return [[pool.name, pool.usablePhotosCount]];
  }));
};

/**
 * @param {unknown} count
 * @returns {string|null}
 */
export const formatUsableImageCount = (count) => (
  typeof count === 'number' && Number.isInteger(count) && count >= 0
    ? `${count} image${count === 1 ? '' : 's'}`
    : null
);

/**
 * @param {unknown} count
 * @returns {string|null}
 */
export const formatAccessibleUsableImageCount = (count) => (
  typeof count === 'number' && Number.isInteger(count) && count >= 0
    ? `${count} usable image${count === 1 ? '' : 's'}`
    : null
);
