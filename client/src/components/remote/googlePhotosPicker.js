// @ts-check

/**
 * @typedef {Object} GooglePhotosPickerStatus
 * @property {string} heading
 * @property {string} description
 * @property {string} actionLabel
 */

export const GOOGLE_PHOTOS_PICKER_COPY = Object.freeze({
  eyebrow: 'External Photo Source',
  title: 'Google Photos Picker',
  description: 'Select photos from your private Google Photos library through Google\'s secure Picker flow. This source is independent of the scenic pools below.',
  credentialNote: 'OAuth client credentials are stored in Lumina\'s shared .env file and are only needed to start the Picker flow.',
  readyHeading: 'Google Photos Picker ready',
  readyDescription: 'Google Photos authorization is configured. Selected items are added to the Google Photos feed; they are not added to the selected scenic pool.',
  setupActionLabel: 'Set up Google Photos Picker',
  readyActionLabel: 'Choose photos in Google Photos'
});

/**
 * Purely maps the credential state to the visible Picker status.
 *
 * @param {boolean} isSavedEnv
 * @returns {GooglePhotosPickerStatus}
 */
export const getGooglePhotosPickerStatus = (isSavedEnv) => isSavedEnv
  ? {
      heading: GOOGLE_PHOTOS_PICKER_COPY.readyHeading,
      description: GOOGLE_PHOTOS_PICKER_COPY.readyDescription,
      actionLabel: GOOGLE_PHOTOS_PICKER_COPY.readyActionLabel
    }
  : {
      heading: GOOGLE_PHOTOS_PICKER_COPY.title,
      description: GOOGLE_PHOTOS_PICKER_COPY.description,
      actionLabel: GOOGLE_PHOTOS_PICKER_COPY.setupActionLabel
    };
