// @ts-check

/** @typedef {'next'|'previous'} SwipeDirection */
/** @typedef {{direction: SwipeDirection, status: string}} SwipeDecision */

export const SWIPE_THRESHOLD_PX = 50;
export const DEFAULT_SWIPE_STATUS = 'Swipe left or right to change photo';

const SWIPE_DECISIONS = Object.freeze({
  next: Object.freeze({ direction: 'next', status: 'Swiped Left: Next Photo' }),
  previous: Object.freeze({ direction: 'previous', status: 'Swiped Right: Previous Photo' })
});

const TRIGGERED_STATUS = Object.freeze({
  next: 'Next Photo Triggered',
  previous: 'Previous Photo Triggered'
});

/**
 * Read the horizontal coordinate from the first touch in a browser event.
 * The event collection remains opaque to the pure gesture algebra.
 *
 * @param {unknown} touches
 * @returns {number|null}
 */
export const getTouchClientX = (touches) => {
  const touchList = /** @type {{0?: {clientX?: unknown}}|null|undefined} */ (touches);
  const clientX = touchList?.[0]?.clientX;
  return typeof clientX === 'number' && Number.isFinite(clientX) ? clientX : null;
};

/**
 * Classify a horizontal swipe without dispatching actions or scheduling UI work.
 * Exactly-threshold movement remains inert for compatibility with the hook.
 *
 * @param {unknown} startX
 * @param {unknown} endX
 * @param {number} [threshold=SWIPE_THRESHOLD_PX]
 * @returns {SwipeDecision|null}
 */
export const classifySwipe = (startX, endX, threshold = SWIPE_THRESHOLD_PX) => {
  if (!Number.isFinite(startX) || !Number.isFinite(endX)) return null;

  const diffX = startX - endX;
  if (Math.abs(diffX) <= threshold) return null;

  return SWIPE_DECISIONS[diffX > 0 ? 'next' : 'previous'];
};

/**
 * Project a manual navigation direction into the existing transient status.
 *
 * @param {SwipeDirection} direction
 * @returns {string}
 */
export const getTriggeredSwipeStatus = (direction) => TRIGGERED_STATUS[direction];
