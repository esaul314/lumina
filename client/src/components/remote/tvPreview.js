// @ts-check

/** @typedef {{width: number, height: number}} TvDimensions */
/** @typedef {{width?: number, height?: number}} TvDimensionsInput */

export const DEFAULT_TV_FRAME_ASPECT_RATIO = 16 / 9;
export const DEFAULT_TV_PREVIEW_DIMENSIONS = { width: 350, height: 180 };

/**
 * Derive a TV aspect ratio from measured viewport dimensions.
 *
 * @param {TvDimensionsInput|null|undefined} viewport
 * @returns {number}
 */
export function getTvAspectRatio(viewport) {
  const width = Number(viewport?.width);
  const height = Number(viewport?.height);

  if (width > 0 && height > 0) {
    return width / height;
  }

  return DEFAULT_TV_FRAME_ASPECT_RATIO;
}

/**
 * Fit a preview frame into measured bounds while preserving the requested TV
 * aspect ratio. Dimension fallback and geometry stay pure; measurement and
 * DOM style application remain in the view shell.
 *
 * @param {TvDimensionsInput|null|undefined} dimensions
 * @param {number} [aspectRatio=DEFAULT_TV_FRAME_ASPECT_RATIO]
 * @returns {TvDimensions}
 */
export function fitTvPreviewFrame(dimensions, aspectRatio = DEFAULT_TV_FRAME_ASPECT_RATIO) {
  const width = dimensions?.width || DEFAULT_TV_PREVIEW_DIMENSIONS.width;
  const height = dimensions?.height || DEFAULT_TV_PREVIEW_DIMENSIONS.height;

  if (width <= 0 || height <= 0) {
    return DEFAULT_TV_PREVIEW_DIMENSIONS;
  }

  const containerRatio = width / height;

  if (containerRatio > aspectRatio) {
    return {
      width: height * aspectRatio,
      height
    };
  }

  return {
    width,
    height: width / aspectRatio
  };
}
