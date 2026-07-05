// @ts-check

/**
 * @typedef {import('./types').Command} Command
 */

const { validatePercent, validateRating } = require('../utils/validation.js');

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeKeywordList(keywords) {
  if (Array.isArray(keywords)) {
    return keywords.map((keyword) => String(keyword).trim()).filter(Boolean);
  }

  if (typeof keywords === 'string') {
    return keywords.split(/[;,]/).map((keyword) => keyword.trim()).filter(Boolean);
  }

  return [];
}

function decodeCategorySelectionFromHttp(query) {
  const categories = typeof query?.category === 'string'
    ? query.category
    : (typeof query?.categories === 'string'
      ? query.categories
      : (Array.isArray(query?.categories) ? query.categories.join(',') : ''));

  if (!categories) {
    return null;
  }

  return {
    type: 'select-categories',
    payload: {
      categories
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

function decodeAdvancePhotoCommand(direction, strategy = 'smart') {
  if (direction !== 'next' && direction !== 'prev') {
    return null;
  }

  return {
    type: 'advance-photo',
    payload: {
      direction,
      strategy: strategy === 'sequence' ? 'sequence' : 'smart'
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

function decodeAddPoolCommand(payload) {
  const name = trimString(payload?.name ?? payload?.category);
  const keywords = normalizeKeywordList(payload?.keywords ?? payload?.keyword);

  if (!name || keywords.length === 0) {
    return null;
  }

  return {
    type: 'add-pool',
    payload: {
      name,
      keywords
    }
  };
}

function decodeDeletePoolCommand(payload) {
  const name = trimString(typeof payload === 'string' ? payload : (payload?.name ?? payload?.category));

  if (!name) {
    return null;
  }

  return {
    type: 'delete-pool',
    payload: {
      name
    }
  };
}

function decodePoolKeywordsCommand(payload) {
  const name = trimString(payload?.name ?? payload?.category);
  const keywords = normalizeKeywordList(payload?.keywords);

  if (!name || keywords.length === 0) {
    return null;
  }

  return {
    type: 'set-pool-keywords',
    payload: {
      name,
      keywords
    }
  };
}

function decodePoolFeedConfigCommand(payload) {
  const name = trimString(payload?.name ?? payload?.category);
  const source = trimString(payload?.source);
  const config = payload?.config;

  if (!name || !source || !config || typeof config !== 'object' || Array.isArray(config)) {
    return null;
  }

  return {
    type: 'merge-pool-feed-config',
    payload: {
      name,
      source,
      config
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
  decodeAddPoolCommand,
  decodeActivePhotoCommand,
  decodeAdvancePhotoCommand,
  decodeCategorySelectionFromHttp,
  decodeCategorySelectionFromSocket,
  decodeDeletePoolCommand,
  decodeExcludedKeywordsCommand,
  decodePoolFeedConfigCommand,
  decodePoolKeywordsCommand,
  decodePhotoCropCommand,
  decodePhotoMetadataCommand,
  decodePhotoRatingCommand,
  decodeSplitCropCommand,
  decodeSplitPortraitCommand
};
