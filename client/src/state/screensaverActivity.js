// @ts-check

/**
 * @typedef {{key?: string, code?: string}} KeyboardActivity
 */

/**
 * @typedef {{type?: string}} ActivityEvent
 */

/**
 * @typedef {{screensaverActive: boolean, event?: ActivityEvent|null}} ScreensaverActivity
 */

const DISMISSAL_EVENT_TYPES = new Set([
  'keydown',
  'mousedown',
  'mousemove',
  'scroll',
  'touchstart'
]);

/**
 * Identify Escape without coupling the pure boundary to a browser event class.
 * Both keyboard properties are accepted because browsers and test doubles may
 * expose either the semantic key or the physical code.
 *
 * @param {KeyboardActivity|null|undefined} event
 * @returns {boolean}
 */
const isEscapeKey = (event) => event?.key === 'Escape' || event?.code === 'Escape';

/**
 * Project active screensaver input into the dismissal policy used by the
 * Dashboard. Inactive screensavers and unknown event types are inert.
 *
 * @param {ScreensaverActivity} input
 * @returns {boolean}
 */
const isScreensaverDismissalActivity = ({ screensaverActive, event }) => (
  Boolean(screensaverActive)
  && DISMISSAL_EVENT_TYPES.has(event?.type)
);

export {
  isEscapeKey,
  isScreensaverDismissalActivity
};
