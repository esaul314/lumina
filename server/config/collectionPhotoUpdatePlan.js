// @ts-check

const { updatePhotosList } = require('./collectionPhotoProjections.js');
const { updatePhotoInCollections } = require('../domain/selectors.js');

/** @typedef {Record<string, unknown> & {url?: unknown}} PhotoRecord */
/** @typedef {PhotoRecord | null | undefined} PhotoValue */
/** @typedef {Record<string, PhotoRecord[] | null | undefined>} PhotoCollections */
/** @typedef {Record<string, unknown> & {
 *   photosList?: PhotoValue[] | null;
 *   activePhoto?: PhotoValue;
 *   activeSecondPhoto?: PhotoValue;
 * }} PhotoUpdateState */
/** @typedef {(photo: PhotoRecord) => PhotoRecord} PhotoUpdater */
/** @typedef {{
 *   photosList?: PhotoValue[];
 *   activePhoto?: PhotoRecord;
 *   activeSecondPhoto?: PhotoRecord;
 * }} PhotoStateUpdates */
/** @typedef {{
 *   collections: PhotoCollections;
 *   changed: boolean;
 *   stateUpdates: PhotoStateUpdates;
 * }} PhotoFieldUpdatePlan */

/**
 * Derive the collection and matching state-field updates without mutating
 * either input. A rating of 1 preserves the existing immediate feed-pruning
 * policy; persistence and applying the plan remain in `collections.js`.
 *
 * @param {PhotoCollections} collections
 * @param {PhotoUpdateState | null | undefined} state
 * @param {string} url
 * @param {PhotoUpdater} updater
 * @param {number | undefined} optionalRating
 * @returns {PhotoFieldUpdatePlan}
 */
const projectPhotoFieldUpdate = (collections, state, url, updater, optionalRating) => {
  const collectionUpdate = updatePhotoInCollections(collections, url, updater);
  if (!collectionUpdate.changed) {
    return { collections, changed: false, stateUpdates: {} };
  }

  const stateUpdates = /** @type {PhotoStateUpdates} */ ({});
  if (Array.isArray(state?.photosList)) {
    const nextPhotosList = updatePhotosList(url, updater, state.photosList);
    stateUpdates.photosList = optionalRating === 1
      ? nextPhotosList.filter((photo) => photo?.url !== url)
      : nextPhotosList;
  }

  const activePhoto = state?.activePhoto;
  if (activePhoto?.url === url) {
    stateUpdates.activePhoto = updater(activePhoto);
  }

  const activeSecondPhoto = state?.activeSecondPhoto;
  if (activeSecondPhoto?.url === url) {
    stateUpdates.activeSecondPhoto = updater(activeSecondPhoto);
  }

  return {
    collections: collectionUpdate.collections,
    changed: true,
    stateUpdates
  };
};

module.exports = { projectPhotoFieldUpdate };
