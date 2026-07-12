// @ts-check

/**
 * @typedef {import('./types').Command} Command
 */

const { curry } = require('../utils/fn.js');
const {
  normalizeKeywordEntries,
  normalizeKeywordTerms
} = require('../utils/keywordSpecs.js');
const {
  validatePercent,
  validatePhotoCropPercent,
  validateRating
} = require('../utils/validation.js');

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

const createCommand = curry((type, payload) => ({
  type,
  payload
}));

const readRequiredString = (value) => (
  typeof value === 'string' && value.trim()
    ? value
    : null
);

const mergeDecodedFields = (parts) => parts.reduce((merged, part) => (
  merged && part
    ? { ...merged, ...part }
    : null
), {});

const createRequiredValueCommandDecoder = curry((type, readRequiredValue, buildPayload, input) => {
  const requiredValue = readRequiredValue(input);
  if (requiredValue === null) {
    return null;
  }

  const payload = buildPayload(requiredValue, input);
  return payload ? createCommand(type, payload) : null;
});

const decodeOptionalField = curry((field, validator, payload) => {
  if (payload?.[field] === undefined) {
    return {};
  }

  const normalized = validator(payload[field]);
  return normalized === null ? null : { [field]: normalized };
});

const readPhotoUrl = (payload) => readRequiredString(payload?.url);
const createPhotoCommandDecoder = curry((type, buildPayload, payload) => (
  createRequiredValueCommandDecoder(type, readPhotoUrl, buildPayload, payload)
));
const readPoolName = (payload) => readRequiredString(trimString(payload?.name ?? payload?.category));
const createPoolCommandDecoder = curry((type, buildPayload, payload) => (
  createRequiredValueCommandDecoder(type, readPoolName, buildPayload, payload)
));
const readActivePhotoUrl = (payload) => readRequiredString(
  typeof payload === 'string'
    ? payload
    : payload?.url
);
const createSocketCommandSpec = (event, decode, extra = {}) => ({ event, decode, ...extra });

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

  return createCommand('select-categories', {
    categories: category
  });
}

const decodePhotoRatingCommand = createPhotoCommandDecoder('rate-photo', (url, payload) => {
  const rating = validateRating(payload.rating);
  return rating === null ? null : { url, rating };
});

const decodePhotoCropCommand = createPhotoCommandDecoder('set-photo-crop', (url, payload) => {
  const fields = mergeDecodedFields([
    decodeOptionalField('cropPercent', validatePhotoCropPercent, payload),
    decodeOptionalField('cropPositionY', validatePercent, payload)
  ]);

  return fields ? { url, ...fields } : null;
});

const decodePhotoPreventPairingCommand = createPhotoCommandDecoder(
  'set-photo-prevent-pairing',
  (url, payload) => ({
    url,
    preventPairing: Boolean(payload.preventPairing),
    preserveActive: Boolean(payload.preserveActive)
  })
);

const decodeBrokenPhotoCommand = createPhotoCommandDecoder(
  'mark-photo-broken',
  (url) => ({ url })
);

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
  return createRequiredValueCommandDecoder(
    'set-active-photo',
    readActivePhotoUrl,
    (activeUrl, input) => ({
      url: activeUrl,
      ...(input && typeof input === 'object' ? { photo: input } : {})
    }),
    payload
  );
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

const createSocketStatePatchSpec = curry((event, buildPatch) => ({
  event,
  decode: createStatePatchCommandDecoder(buildPatch)
}));

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

const createEnvSecretCommandDecoder = curry((envKey, runtimeFlag, payload) => {
  const rawValue = payload?.token ?? payload?.value;
  if (typeof rawValue !== 'string') {
    return null;
  }

  return {
    type: 'save-env-secret',
    payload: {
      envKey,
      runtimeFlag,
      value: trimString(rawValue)
    }
  };
});

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

  return createCommand('set-screensaver-active', {
    active: payload.active
  });
}

const decodeScreensaverActiveFromSocket = (active) => decodeScreensaverActiveCommand({ active });

const SOCKET_STATE_PATCH_SPECS = [
  createSocketStatePatchSpec('toggle-widget', buildWidgetPatch),
  createSocketStatePatchSpec('toggle-align-time', buildBooleanFieldPatch('alignTimeOfDay')),
  createSocketStatePatchSpec('toggle-align-weather', buildBooleanFieldPatch('alignWeather')),
  createSocketStatePatchSpec('toggle-allow-openai-fallback', buildBooleanFieldPatch('allowOpenAiFallback')),
  createSocketStatePatchSpec('change-scale-mode', buildEnumFieldPatch('scaleMode', ['cover', 'contain'])),
  createSocketStatePatchSpec('toggle-split-portrait', buildBooleanFieldPatch('splitPortrait')),
  createSocketStatePatchSpec('change-split-crop', buildPercentFieldPatch('splitCropPercent')),
  createSocketStatePatchSpec('update-vision-config', buildObjectFieldPatch('visionConfig')),
  createSocketStatePatchSpec('change-night-percentage', buildPercentFieldPatch('nightPercentage')),
  createSocketStatePatchSpec('change-interval', buildFiniteNumberFieldPatch('slideshowInterval')),
  createSocketStatePatchSpec('change-theme', buildTrimmedStringFieldPatch('theme')),
  createSocketStatePatchSpec('toggle-auto-location', buildBooleanFieldPatch('autoLocation')),
  createSocketStatePatchSpec('update-manual-location', buildObjectFieldPatch('manualLocation'))
];

const decodeAddPoolCommand = createPoolCommandDecoder('add-pool', (name, payload) => {
  const keywords = normalizeKeywordTerms(payload?.keywords ?? payload?.keyword, { splitString: true });
  return keywords.length === 0 ? null : { name, keywords };
});

function decodeDeletePoolCommand(payload) {
  const input = typeof payload === 'string' ? { name: payload } : payload;

  return createPoolCommandDecoder('delete-pool', (name) => ({ name }), input);
}

const decodePoolKeywordsCommand = createPoolCommandDecoder('set-pool-keywords', (name, payload) => {
  const keywords = normalizeKeywordEntries(payload?.keywords, { splitTopLevelString: true });
  return keywords.length === 0 ? null : { name, keywords };
});

const decodePoolFeedConfigCommand = createPoolCommandDecoder('merge-pool-feed-config', (name, payload) => {
  const source = trimString(payload?.source);
  const config = payload?.config;

  if (!source || !isPlainObject(config)) {
    return null;
  }

  return {
    name,
    source,
    config
  };
});

function decodeRecrawlCommand(payload) {
  return decodeScopedJobCommand(payload, 'trigger-recrawl');
}

function decodeVisionAnalysisCommand(payload) {
  return decodeScopedJobCommand(payload, 'trigger-vision-analysis');
}

function decodeScopedJobCommand(payload, type) {
  if (payload === undefined || payload === null) {
    return createCommand(type, {});
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

  return createCommand(type, categories.length > 0 ? { categories } : {});
}

const decodePhotoMetadataCommand = createPhotoCommandDecoder('report-photo-metadata', (url, payload) => {
  if (payload.orientation !== 'portrait' && payload.orientation !== 'landscape') {
    return null;
  }

  return {
    url,
    orientation: payload.orientation,
    ...(payload.width !== undefined ? { width: Number(payload.width) } : {}),
    ...(payload.height !== undefined ? { height: Number(payload.height) } : {})
  };
});

const decodeUseApiTokenCommand = createEnvSecretCommandDecoder('USEAPI_TOKEN', 'hasUseApiToken');
const decodeTumblrApiKeyCommand = createEnvSecretCommandDecoder('TUMBLR_API_KEY', 'hasTumblrApiKey');

const SOCKET_DURABLE_COMMAND_SPECS = [
  createSocketCommandSpec('change-category', decodeCategorySelectionFromSocket, {
    fallbackKey: 'categorySelection',
    logMessage: (category) => `[SOCKET EVENT] change-category received: "${category}"`
  }),
  createSocketCommandSpec('set-active-photo', decodeActivePhotoCommand, {
    fallbackKey: 'activePhoto'
  }),
  createSocketCommandSpec('report-photo-metadata', decodePhotoMetadataCommand, {
    fallbackKey: 'photoMetadata'
  }),
  createSocketCommandSpec('rate-photo', decodePhotoRatingCommand, {
    fallbackKey: 'photoRating'
  }),
  createSocketCommandSpec('set-photo-crop', decodePhotoCropCommand, {
    fallbackKey: 'photoCrop'
  }),
  createSocketCommandSpec('set-photo-prevent-pairing', decodePhotoPreventPairingCommand, {
    fallbackKey: 'photoPreventPairing'
  }),
  createSocketCommandSpec('update-keywords', decodePoolKeywordsCommand, {
    fallbackKey: 'poolKeywords'
  }),
  createSocketCommandSpec('update-feed-config', decodePoolFeedConfigCommand, {
    fallbackKey: 'poolFeedConfig'
  }),
  createSocketCommandSpec('update-excluded-keywords', decodeExcludedKeywordsCommand, {
    fallbackKey: 'excludedKeywords'
  }),
  createSocketCommandSpec('add-category', decodeAddPoolCommand, {
    fallbackKey: 'addPool'
  }),
  createSocketCommandSpec('delete-category', decodeDeletePoolCommand, {
    fallbackKey: 'deletePool'
  }),
  createSocketCommandSpec('next-photo', () => decodeAdvancePhotoCommand('next'), {
    fallbackKey: 'advancePhoto',
    fallbackArgs: ['next']
  }),
  createSocketCommandSpec('prev-photo', () => decodeAdvancePhotoCommand('prev'), {
    fallbackKey: 'advancePhoto',
    fallbackArgs: ['prev']
  }),
  createSocketCommandSpec('set-screensaver-active', decodeScreensaverActiveFromSocket, {
    fallbackKey: 'screensaverActive'
  }),
  createSocketCommandSpec('mark-photo-broken', decodeBrokenPhotoCommand, {
    fallbackKey: 'brokenPhoto',
    logMessage: (payload) => `[SOCKET EVENT] mark-photo-broken received for URL: ${payload?.url}`
  })
];

const SOCKET_ASYNC_JOB_COMMAND_SPECS = [
  createSocketCommandSpec('trigger-recrawl', decodeRecrawlCommand, {
    logMessage: '[SOCKET EVENT] trigger-recrawl received. Initiating manual crawl...',
    unavailableEvent: 'recrawl-complete',
    unavailablePayload: {
      success: false,
      error: 'Recrawl dispatcher unavailable.'
    }
  }),
  createSocketCommandSpec('trigger-vision-analysis', decodeVisionAnalysisCommand, {
    logMessage: '[SOCKET EVENT] trigger-vision-analysis received. Initiating manual vision analysis...',
    unavailableEvent: 'job-status',
    unavailablePayload: {
      type: 'vision-analysis',
      status: 'failed',
      error: 'Vision-analysis dispatcher unavailable.'
    }
  })
];

const SOCKET_SECRET_COMMAND_SPECS = [
  createSocketCommandSpec('save-useapi-token', decodeUseApiTokenCommand, {
    envKey: 'USEAPI_TOKEN',
    runtimeFlag: 'hasUseApiToken',
    successEvent: 'useapi-token-saved'
  }),
  createSocketCommandSpec('save-tumblr-api-key', decodeTumblrApiKeyCommand, {
    envKey: 'TUMBLR_API_KEY',
    runtimeFlag: 'hasTumblrApiKey',
    successEvent: 'tumblr-api-key-saved'
  })
];

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
  SOCKET_ASYNC_JOB_COMMAND_SPECS,
  SOCKET_DURABLE_COMMAND_SPECS,
  SOCKET_SECRET_COMMAND_SPECS,
  decodeTumblrApiKeyCommand,
  decodeStatePatchCommand,
  decodeUseApiTokenCommand,
  SOCKET_STATE_PATCH_SPECS,
  STATE_PATCH_FIELDS,
  createStatePatchCommandDecoder,
  buildBooleanFieldPatch,
  buildEnumFieldPatch,
  buildFiniteNumberFieldPatch,
  buildObjectFieldPatch,
  buildPercentFieldPatch,
  buildTrimmedStringFieldPatch,
  buildWidgetPatch
};
