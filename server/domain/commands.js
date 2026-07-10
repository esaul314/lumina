// @ts-check

/**
 * @typedef {import('./types').Command} Command
 */

const { curry } = require('../utils/fn.js');
const { validatePercent, validateRating } = require('../utils/validation.js');

const STATE_PATCH_FIELDS = [
  'theme',
  'inactivityTimeout',
  'slideshowInterval',
  'scaleMode',
  'splitPortrait',
  'splitCropPercent',
  'alignTimeOfDay',
  'alignWeather',
  'nightPercentage',
  'allowOpenAiFallback'
];

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeKeywordList(keywords) {
  const rawKeywords = Array.isArray(keywords)
    ? keywords
    : (typeof keywords === 'string' ? keywords.split(/[;,]/) : []);

  return rawKeywords.map((keyword) => String(keyword).trim()).filter(Boolean);
}

function decodeCategorySelectionFromHttp(query) {
  const { category, categories: rawCategories } = query || {};
  const categories = typeof category === 'string'
    ? category
    : (typeof rawCategories === 'string'
      ? rawCategories
      : (Array.isArray(rawCategories) ? rawCategories.join(',') : ''));

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

function decodePhotoPreventPairingCommand(payload) {
  if (!payload || typeof payload.url !== 'string' || !payload.url.trim()) {
    return null;
  }

  return {
    type: 'set-photo-prevent-pairing',
    payload: {
      url: payload.url,
      preventPairing: Boolean(payload.preventPairing),
      preserveActive: Boolean(payload.preserveActive)
    }
  };
}

function decodeBrokenPhotoCommand(payload) {
  if (!payload || typeof payload.url !== 'string' || !payload.url.trim()) {
    return null;
  }

  return {
    type: 'mark-photo-broken',
    payload: {
      url: payload.url
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

function normalizeCoordinate(value, fallback) {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeVisionConfig(config) {
  return {
    apiUrl: trimString(config?.apiUrl),
    apiKey: trimString(config?.apiKey),
    model: trimString(config?.model),
    fallbackUrl: trimString(config?.fallbackUrl),
    fallbackApiKey: trimString(config?.fallbackApiKey),
    fallbackModel: trimString(config?.fallbackModel)
  };
}

function decodeStatePatchCommand(payload) {
  if (!isPlainObject(payload)) {
    return null;
  }

  const patch = STATE_PATCH_FIELDS.reduce((nextPatch, field) => (
    payload[field] === undefined
      ? nextPatch
      : { ...nextPatch, [field]: payload[field] }
  ), /** @type {Record<string, unknown>} */ ({}));

  if (Array.isArray(payload.excludedKeywords)) {
    patch.excludedKeywords = payload.excludedKeywords;
  }

  if (isPlainObject(payload.visionConfig)) {
    patch.visionConfig = normalizeVisionConfig(payload.visionConfig);
  }

  if (payload.autoLocation !== undefined) {
    patch.autoLocation = Boolean(payload.autoLocation);
  }

  if (isPlainObject(payload.manualLocation)) {
    const { lat, lon, city, regionName, country } = payload.manualLocation;
    patch.manualLocation = {
      lat: normalizeCoordinate(lat, 45.45),
      lon: normalizeCoordinate(lon, -73.56),
      city: trimString(city) || 'Verdun',
      regionName: trimString(regionName) || 'Quebec',
      country: trimString(country) || 'Canada'
    };
  }

  if (isPlainObject(payload.widgets)) {
    patch.widgets = { ...payload.widgets };
  }

  return {
    type: 'patch-state',
    payload: patch
  };
}

const createStatePatchCommandDecoder = (buildPatch) => (payload) => {
  const patch = buildPatch(payload);
  return patch ? decodeStatePatchCommand(patch) : null;
};

const buildBooleanFieldPatch = curry((field, value) => ({
  [field]: Boolean(value)
}));

const buildEnumFieldPatch = curry((field, allowedValues, value) => (
  allowedValues.includes(value)
    ? { [field]: value }
    : null
));

const buildFiniteNumberFieldPatch = curry((field, value) => (
  Number.isFinite(value)
    ? { [field]: value }
    : null
));

const buildPercentFieldPatch = curry((field, value) => {
  const normalized = validatePercent(value);
  return normalized === null ? null : { [field]: normalized };
});

const buildTrimmedStringFieldPatch = curry((field, value) => {
  const normalized = trimString(value);
  return normalized ? { [field]: normalized } : null;
});

const buildObjectFieldPatch = curry((field, value) => (
  isPlainObject(value)
    ? { [field]: value }
    : null
));

function buildWidgetPatch(payload) {
  const widgetName = trimString(payload?.widgetName);
  if (!widgetName) {
    return null;
  }

  return {
    widgets: {
      [widgetName]: payload?.visible
    }
  };
}

function decodeScreensaverActiveCommand(payload) {
  if (!payload || typeof payload.active !== 'boolean') {
    return null;
  }

  return {
    type: 'set-screensaver-active',
    payload: {
      active: payload.active
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

function decodeRecrawlCommand(payload) {
  return decodeScopedJobCommand(payload, 'trigger-recrawl');
}

function decodeVisionAnalysisCommand(payload) {
  return decodeScopedJobCommand(payload, 'trigger-vision-analysis');
}

function decodeScopedJobCommand(payload, type) {
  if (payload === undefined || payload === null) {
    return {
      type,
      payload: {}
    };
  }

  if (typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const categories = Array.isArray(payload.categories)
    ? payload.categories.map(trimString).filter(Boolean)
    : [trimString(payload.categories)].filter(Boolean);

  if (payload.categories !== undefined && categories.length === 0) {
    return null;
  }

  return {
    type,
    payload: categories.length > 0 ? { categories } : {}
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
  decodePhotoPreventPairingCommand,
  decodeRecrawlCommand,
  decodeScreensaverActiveCommand,
  decodeVisionAnalysisCommand,
  decodeBrokenPhotoCommand,
  decodePhotoMetadataCommand,
  decodePhotoRatingCommand,
  decodeStatePatchCommand,
  createStatePatchCommandDecoder,
  buildBooleanFieldPatch,
  buildEnumFieldPatch,
  buildFiniteNumberFieldPatch,
  buildObjectFieldPatch,
  buildPercentFieldPatch,
  buildTrimmedStringFieldPatch,
  buildWidgetPatch,
  decodeSplitCropCommand,
  decodeSplitPortraitCommand
};
