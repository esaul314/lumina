// @ts-check

/** @typedef {{startY: number, startCropY: number, clientY: number, containerHeight?: number, sensitivity?: number}} CropDragInput */
/** @typedef {number} CropPosition */

export const DEFAULT_CROP_CONTAINER_HEIGHT = 180;
export const DEFAULT_CROP_SENSITIVITY = 0.8;

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/**
 * Read the vertical coordinate from the first touch in a browser event.
 * The event collection remains opaque to the pure crop projection.
 *
 * @param {unknown} touches
 * @returns {number|null}
 */
export const getTouchClientY = (touches) => {
  const touchList = /** @type {{0?: {clientY?: unknown}}|null|undefined} */ (touches);
  const clientY = touchList?.[0]?.clientY;
  return isFiniteNumber(clientY) ? clientY : null;
};

/**
 * Decode either a touch or mouse/pointer event without coupling the pure
 * projection to a browser event class.
 *
 * @param {unknown} event
 * @returns {number|null}
 */
export const getPointerClientY = (event) => {
  const pointerEvent = /** @type {{touches?: unknown, clientY?: unknown}|null|undefined} */ (event);
  if (pointerEvent?.touches != null) return getTouchClientY(pointerEvent.touches);

  return isFiniteNumber(pointerEvent?.clientY) ? pointerEvent.clientY : null;
};

/**
 * Project a drag coordinate into the bounded crop position used by the
 * preview. Invalid coordinates remain inert instead of leaking NaN into the
 * React state or the delayed crop action.
 *
 * @param {CropDragInput} input
 * @returns {CropPosition|null}
 */
export const projectCropPosition = ({
  startY,
  startCropY,
  clientY,
  containerHeight = DEFAULT_CROP_CONTAINER_HEIGHT,
  sensitivity = DEFAULT_CROP_SENSITIVITY
}) => {
  if (![startY, startCropY, clientY, containerHeight, sensitivity].every(isFiniteNumber)) {
    return null;
  }

  const effectiveHeight = containerHeight || DEFAULT_CROP_CONTAINER_HEIGHT;
  const deltaPercent = ((clientY - startY) / effectiveHeight) * 100 * sensitivity;
  const nextCropY = Math.round(startCropY - deltaPercent);

  return Math.max(0, Math.min(100, nextCropY));
};
