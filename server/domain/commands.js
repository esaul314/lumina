// @ts-check

/**
 * @typedef {import('./types').Command} Command
 */

const { validatePercent, validateRating } = require('../utils/validation.js');

function decodeCategorySelectionFromHttp(query) {
  if (!query || typeof query.category !== 'string') {
    return null;
  }

  return {
    type: 'select-categories',
    payload: {
      categories: query.category
    }
  };
}

function decodeCategorySelectionFromSocket(category) {
  if (typeof category !== 'string' || !category.trim()) {
    return null;
  }

  return {
    type: 'select-categories',
    payload: {
      categories: category
    }
  };
}

function decodePhotoRatingCommand(payload) {
  if (!payload || typeof payload.url !== 'string' || !payload.url.trim()) {
    return null;
  }

  const rating = validateRating(payload.rating);
  if (rating === null) {
    return null;
  }

  return {
    type: 'rate-photo',
    payload: {
      url: payload.url,
      rating
    }
  };
}

function decodePhotoCropCommand(payload) {
  if (!payload || typeof payload.url !== 'string' || !payload.url.trim()) {
    return null;
  }

  const cropPercent = payload.cropPercent !== undefined ? validatePercent(payload.cropPercent) : undefined;
  const cropPositionY = payload.cropPositionY !== undefined ? validatePercent(payload.cropPositionY) : undefined;

  if (payload.cropPercent !== undefined && cropPercent === null) {
    return null;
  }

  if (payload.cropPositionY !== undefined && cropPositionY === null) {
    return null;
  }

  return {
    type: 'set-photo-crop',
    payload: {
      url: payload.url,
      ...(cropPercent !== undefined ? { cropPercent } : {}),
      ...(cropPositionY !== undefined ? { cropPositionY } : {})
    }
  };
}

function decodeExcludedKeywordsCommand(keywords) {
  if (!Array.isArray(keywords)) {
    return null;
  }

  return {
    type: 'update-excluded-keywords',
    payload: {
      keywords
    }
  };
}

function decodeActivePhotoCommand(payload) {
  const url = typeof payload === 'string'
    ? payload
    : (payload && typeof payload.url === 'string' ? payload.url : '');

  if (!url.trim()) {
    return null;
  }

  return {
    type: 'set-active-photo',
    payload: {
      url,
      ...(payload && typeof payload === 'object' ? { photo: payload } : {})
    }
  };
}

function decodeAdvancePhotoCommand(direction) {
  if (direction !== 'next' && direction !== 'prev') {
    return null;
  }

  return {
    type: 'advance-photo',
    payload: {
      direction
    }
  };
}

function decodeSplitPortraitCommand(enabled) {
  return {
    type: 'set-split-portrait',
    payload: {
      enabled: Boolean(enabled)
    }
  };
}

function decodeSplitCropCommand(percent) {
  const value = validatePercent(percent);
  if (value === null) {
    return null;
  }

  return {
    type: 'set-split-crop',
    payload: {
      percent: value
    }
  };
}

function decodePhotoMetadataCommand(payload) {
  if (!payload || typeof payload.url !== 'string' || !payload.url.trim()) {
    return null;
  }

  if (payload.orientation !== 'portrait' && payload.orientation !== 'landscape') {
    return null;
  }

  return {
    type: 'report-photo-metadata',
    payload: {
      url: payload.url,
      orientation: payload.orientation,
      ...(payload.width !== undefined ? { width: Number(payload.width) } : {}),
      ...(payload.height !== undefined ? { height: Number(payload.height) } : {})
    }
  };
}

module.exports = {
  decodeActivePhotoCommand,
  decodeAdvancePhotoCommand,
  decodeCategorySelectionFromHttp,
  decodeCategorySelectionFromSocket,
  decodeExcludedKeywordsCommand,
  decodePhotoCropCommand,
  decodePhotoMetadataCommand,
  decodePhotoRatingCommand,
  decodeSplitCropCommand,
  decodeSplitPortraitCommand
};
