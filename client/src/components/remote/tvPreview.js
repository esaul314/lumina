export const DEFAULT_TV_FRAME_ASPECT_RATIO = 16 / 9;
export const DEFAULT_TV_PREVIEW_DIMENSIONS = { width: 350, height: 180 };

export function getTvAspectRatio(viewport) {
  const width = Number(viewport?.width);
  const height = Number(viewport?.height);

  if (width > 0 && height > 0) {
    return width / height;
  }

  return DEFAULT_TV_FRAME_ASPECT_RATIO;
}

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
