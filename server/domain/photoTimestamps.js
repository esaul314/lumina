// @ts-check

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizePhotoAddedAt(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Stamp only photos that do not already carry a valid acquisition timestamp.
 * The returned list is immutable and legacy undated entries remain undated.
 *
 * @param {Date | string | number} addedAt
 * @returns {(photos: Array<Record<string, any>>) => Array<Record<string, any>>}
 */
const stampNewPhotos = (addedAt) => {
  const normalizedAddedAt = normalizePhotoAddedAt(addedAt);

  return (photos = []) => photos.map((photo) => {
    if (
      !photo ||
      typeof photo !== 'object' ||
      normalizePhotoAddedAt(photo.addedAt) ||
      !normalizedAddedAt
    ) {
      return photo;
    }

    return {
      ...photo,
      addedAt: normalizedAddedAt
    };
  });
};

/**
 * Normalize persisted photo metadata without inventing dates for legacy rows.
 *
 * @param {Record<string, any>} photo
 * @returns {Record<string, any>}
 */
function normalizePhotoTimestamp(photo) {
  if (!photo || typeof photo !== 'object') {
    return photo;
  }

  const addedAt = normalizePhotoAddedAt(photo.addedAt);
  if (!addedAt) {
    const { addedAt: _ignored, ...withoutTimestamp } = photo;
    return withoutTimestamp;
  }

  return { ...photo, addedAt };
}

module.exports = {
  normalizePhotoAddedAt,
  normalizePhotoTimestamp,
  stampNewPhotos
};
