// @ts-check

/**
 * @typedef {import('./types').Command} Command
 */

const { curry } = require('../utils/fn.js');
const {
  normalizeManualLocation,
  normalizeVisionConfig,
  pickStatePatchFields,
  STATE_PATCH_FIELDS
} = require('./statePatch.js');
const {
  normalizeKeywordEntries,
  normalizeKeywordTerms
} = require('../utils/keywordSpecs.js');
const {
  validatePercent,
  validatePhotoCropPercent,
  validateRating
} = require('../utils/validation.js');

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
const createRestCommandRouteSpec = (path, decode, extra = {}) => ({ path, decode, ...extra });
const createRestEffectRouteSpec = (path, effectType, decode, extra = {}) => ({
  path,
  effectType,
  decode,
  ...extra
});
const createOptionalCommandRouteSpec = (key, extra = {}) => ({ key, ...extra });
const createEnvSecretTransportSpec = ({
  secretName,
  envKey,
  runtimeFlag
}) => {
  const decode = createEnvSecretCommandDecoder(envKey, runtimeFlag);

  return {
    secretName,
    envKey,
    runtimeFlag,
    decode,
    socketEvent: `save-${secretName}`,
    successEvent: `${secretName}-saved`,
    restPath: `/api/admin/secrets/${secretName}`
  };
};
const createAsyncJobTransportSpec = ({
  socketEvent,
  routePath,
  commandType,
  effectType,
  invalidLabel,
  unavailableLabel,
  unavailableEvent,
  unavailablePayload,
  logMessage
}) => {
  const decode = (payload) => decodeScopedJobCommand(payload, commandType);

  return {
    socketEvent,
    routePath,
    decode,
    effectType,
    logMessage,
    unavailableEvent,
    unavailablePayload,
    invalidMessage: `Invalid ${invalidLabel} payload.`,
    unavailableMessage: `${unavailableLabel} dispatcher unavailable.`,
    missingSubmissionMessage: `${unavailableLabel} job service unavailable.`
  };
};
const createAdvancePhotoTransportSpec = ({
  direction,
  socketEvent,
  routePath,
  notFoundMessage
}) => ({
  direction,
  socketEvent,
  routePath,
  notFoundMessage,
  fallbackArgs: [direction],
  decodeSocket: () => decodeAdvancePhotoCommand(direction),
  decodeRest: () => decodeAdvancePhotoCommand(direction, 'sequence')
});

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

const decodePhotoLovedCommand = createPhotoCommandDecoder(
  'set-photo-loved',
  (url, payload) => ({
    url,
    loved: Boolean(payload.loved)
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

function decodeStatePatchCommand(payload) {
  if (!isPlainObject(payload)) {
    return null;
  }

  const patch = pickStatePatchFields(payload);

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
    patch.manualLocation = normalizeManualLocation(payload.manualLocation);
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

function decodePoolScopedRecrawlCommand(name) {
  const category = trimString(name);
  return category
    ? decodeScopedJobCommand({ categories: [category] }, 'trigger-recrawl')
    : null;
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

const createPhotoTransportSpec = (extra = {}) => ({ ...extra });
const createPhotoRouteSpec = ({
  routeKey,
  routeActive,
  decodeRoute,
  routeError,
  responsePatch = () => ({})
}) => createOptionalCommandRouteSpec(routeKey, {
  active: routeActive,
  decode: decodeRoute,
  error: routeError,
  responsePatch: ({ command }) => responsePatch(command)
});
const createPhotoSocketSpec = ({
  socketEvent,
  decodeSocket,
  fallbackKey,
  logMessage
}) => createSocketCommandSpec(socketEvent, decodeSocket, {
  fallbackKey,
  ...(logMessage ? { logMessage } : {})
});

const PHOTO_TRANSPORT_SPECS = [
  createPhotoTransportSpec({
    routeKey: 'rating',
    routeActive: ({ body }) => body?.rating !== undefined,
    decodeRoute: ({ url, body }) => decodePhotoRatingCommand({ url, rating: body?.rating }),
    routeError: 'Invalid parameter: "rating" must be an integer between 1 and 10.',
    responsePatch: (command) => ({
      rating: command.payload.rating
    }),
    socketEvent: 'rate-photo',
    decodeSocket: decodePhotoRatingCommand,
    fallbackKey: 'photoRating'
  }),
  createPhotoTransportSpec({
    routeKey: 'broken',
    routeActive: ({ body }) => body?.isBroken === true,
    decodeRoute: ({ url }) => decodeBrokenPhotoCommand({ url }),
    routeError: 'Invalid parameter: "url" must be a non-empty string.',
    responsePatch: () => ({
      isBroken: true,
      rating: 1
    }),
    socketEvent: 'mark-photo-broken',
    decodeSocket: decodeBrokenPhotoCommand,
    fallbackKey: 'brokenPhoto',
    logMessage: (payload) => `[SOCKET EVENT] mark-photo-broken received for URL: ${payload?.url}`
  }),
  createPhotoTransportSpec({
    routeKey: 'crop',
    routeActive: ({ body }) => body?.cropPercent !== undefined || body?.cropPositionY !== undefined,
    decodeRoute: ({ url, body }) => decodePhotoCropCommand({
      url,
      cropPercent: body?.cropPercent,
      cropPositionY: body?.cropPositionY
    }),
    routeError: 'Invalid parameter: "cropPercent" must be an integer between 0 and 200, and "cropPositionY" must be an integer between 0 and 100.',
    responsePatch: (command) => ({
      ...(command.payload.cropPercent !== undefined ? { cropPercent: command.payload.cropPercent } : {}),
      ...(command.payload.cropPositionY !== undefined ? { cropPositionY: command.payload.cropPositionY } : {})
    }),
    socketEvent: 'set-photo-crop',
    decodeSocket: decodePhotoCropCommand,
    fallbackKey: 'photoCrop'
  }),
  createPhotoTransportSpec({
    routeKey: 'prevent-pairing',
    routeActive: ({ body }) => body?.preventPairing !== undefined,
    decodeRoute: ({ url, body }) => decodePhotoPreventPairingCommand({
      url,
      preventPairing: body?.preventPairing,
      preserveActive: body?.preserveActive
    }),
    routeError: 'Invalid parameter: "preventPairing" must be a boolean-compatible value.',
    responsePatch: (command) => ({
      preventPairing: command.payload.preventPairing
    }),
    socketEvent: 'set-photo-prevent-pairing',
    decodeSocket: decodePhotoPreventPairingCommand,
    fallbackKey: 'photoPreventPairing'
  }),
  createPhotoTransportSpec({
    routeKey: 'loved',
    routeActive: ({ body }) => body?.loved !== undefined,
    decodeRoute: ({ url, body }) => decodePhotoLovedCommand({
      url,
      loved: body?.loved
    }),
    routeError: 'Invalid parameter: "loved" must be a boolean-compatible value.',
    responsePatch: (command) => ({
      loved: command.payload.loved
    })
  }),
  createPhotoTransportSpec({
    socketEvent: 'report-photo-metadata',
    decodeSocket: decodePhotoMetadataCommand,
    fallbackKey: 'photoMetadata'
  })
];

const PHOTO_PATCH_COMMAND_ROUTE_SPECS = PHOTO_TRANSPORT_SPECS
  .filter(({ routeKey }) => Boolean(routeKey))
  .map(createPhotoRouteSpec);

const createPoolPatchCommandRouteSpecs = ({ feedConfigs } = {}) => [
  createOptionalCommandRouteSpec('keywords', {
    active: ({ body }) => body?.keywords !== undefined,
    decode: ({ name, body }) => decodePoolKeywordsCommand({ name, keywords: body?.keywords }),
    error: 'Invalid parameter: "keywords" must be an array of strings or time-based keyword objects.'
  }),
  ...Object.entries(feedConfigs || {}).map(([source, config]) => createOptionalCommandRouteSpec(
    `feed-config:${source}`,
    {
      active: () => true,
      decode: ({ name }) => decodePoolFeedConfigCommand({ name, source, config }),
      error: `Invalid feed config payload for source "${source}".`
    }
  ))
];

const ENV_SECRET_TRANSPORT_SPECS = [
  createEnvSecretTransportSpec({
    secretName: 'useapi-token',
    envKey: 'USEAPI_TOKEN',
    runtimeFlag: 'hasUseApiToken'
  }),
  createEnvSecretTransportSpec({
    secretName: 'tumblr-api-key',
    envKey: 'TUMBLR_API_KEY',
    runtimeFlag: 'hasTumblrApiKey'
  })
];

const [
  USE_API_TOKEN_SECRET_SPEC,
  TUMBLR_API_KEY_SECRET_SPEC
] = ENV_SECRET_TRANSPORT_SPECS;

const decodeUseApiTokenCommand = USE_API_TOKEN_SECRET_SPEC.decode;
const decodeTumblrApiKeyCommand = TUMBLR_API_KEY_SECRET_SPEC.decode;

const ASYNC_JOB_TRANSPORT_SPECS = [
  createAsyncJobTransportSpec({
    socketEvent: 'trigger-recrawl',
    routePath: '/api/jobs/recrawl',
    commandType: 'trigger-recrawl',
    effectType: 'start-recrawl-job',
    invalidLabel: 'recrawl',
    unavailableLabel: 'Recrawl',
    unavailableEvent: 'recrawl-complete',
    unavailablePayload: {
      success: false,
      error: 'Recrawl dispatcher unavailable.'
    },
    logMessage: '[SOCKET EVENT] trigger-recrawl received. Initiating manual crawl...'
  }),
  createAsyncJobTransportSpec({
    socketEvent: 'trigger-vision-analysis',
    routePath: '/api/jobs/vision-analysis',
    commandType: 'trigger-vision-analysis',
    effectType: 'start-vision-analysis-job',
    invalidLabel: 'vision-analysis',
    unavailableLabel: 'Vision-analysis',
    unavailableEvent: 'job-status',
    unavailablePayload: {
      type: 'vision-analysis',
      status: 'failed',
      error: 'Vision-analysis dispatcher unavailable.'
    },
    logMessage: '[SOCKET EVENT] trigger-vision-analysis received. Initiating manual vision analysis...'
  })
];

const [
  RECRAWL_JOB_TRANSPORT_SPEC,
  VISION_ANALYSIS_JOB_TRANSPORT_SPEC
] = ASYNC_JOB_TRANSPORT_SPECS;

const decodeRecrawlCommand = RECRAWL_JOB_TRANSPORT_SPEC.decode;
const decodeVisionAnalysisCommand = VISION_ANALYSIS_JOB_TRANSPORT_SPEC.decode;

const ADVANCE_PHOTO_TRANSPORT_SPECS = [
  createAdvancePhotoTransportSpec({
    direction: 'next',
    socketEvent: 'next-photo',
    routePath: '/api/photos/next',
    notFoundMessage: 'Could not transition to next photo.'
  }),
  createAdvancePhotoTransportSpec({
    direction: 'prev',
    socketEvent: 'prev-photo',
    routePath: '/api/photos/prev',
    notFoundMessage: 'Could not transition to previous photo.'
  })
];

const SOCKET_DURABLE_COMMAND_SPECS = [
  createSocketCommandSpec('change-category', decodeCategorySelectionFromSocket, {
    fallbackKey: 'categorySelection',
    logMessage: (category) => `[SOCKET EVENT] change-category received: "${category}"`
  }),
  createSocketCommandSpec('set-active-photo', decodeActivePhotoCommand, {
    fallbackKey: 'activePhoto'
  }),
  ...PHOTO_TRANSPORT_SPECS
    .filter(({ socketEvent }) => Boolean(socketEvent))
    .map(createPhotoSocketSpec),
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
  ...ADVANCE_PHOTO_TRANSPORT_SPECS.map(({ socketEvent, decodeSocket, fallbackArgs }) => createSocketCommandSpec(
    socketEvent,
    decodeSocket,
    {
      fallbackKey: 'advancePhoto',
      fallbackArgs
    }
  )),
  createSocketCommandSpec('set-screensaver-active', decodeScreensaverActiveFromSocket, {
    fallbackKey: 'screensaverActive'
  })
];

const SOCKET_ASYNC_JOB_COMMAND_SPECS = ASYNC_JOB_TRANSPORT_SPECS.map(({
  socketEvent,
  decode,
  logMessage,
  unavailableEvent,
  unavailablePayload
}) => createSocketCommandSpec(socketEvent, decode, {
  logMessage,
  unavailableEvent,
  unavailablePayload
}));

const SOCKET_SECRET_COMMAND_SPECS = ENV_SECRET_TRANSPORT_SPECS.map(({
  socketEvent,
  decode,
  envKey,
  runtimeFlag,
  successEvent
}) => createSocketCommandSpec(socketEvent, decode, {
  envKey,
  runtimeFlag,
  successEvent
}));

const REST_ADMIN_SECRET_ROUTE_SPECS = ENV_SECRET_TRANSPORT_SPECS.map(({
  restPath,
  decode,
  secretName
}) => createRestCommandRouteSpec(restPath, decode, {
  secretName
}));

const buildAcceptedJobResponse = (submission) => ({
  job: submission.job,
  reused: Boolean(submission.reused)
});

const REST_ASYNC_JOB_ROUTE_SPECS = ASYNC_JOB_TRANSPORT_SPECS.map(({
  routePath,
  effectType,
  decode,
  invalidMessage,
  unavailableMessage,
  missingSubmissionMessage
}) => createRestEffectRouteSpec(routePath, effectType, decode, {
  invalidMessage,
  unavailableMessage,
  missingSubmissionMessage,
  present: ({ submission }) => buildAcceptedJobResponse(submission)
}));

const REST_ADVANCE_PHOTO_ROUTE_SPECS = ADVANCE_PHOTO_TRANSPORT_SPECS.map(({
  routePath,
  decodeRest,
  notFoundMessage
}) => createRestCommandRouteSpec(routePath, decodeRest, {
  notFoundMessage,
  notFoundStatus: 500
}));

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
  decodePoolScopedRecrawlCommand,
  decodePhotoCropCommand,
  decodePhotoLovedCommand,
  decodePhotoPreventPairingCommand,
  decodeRecrawlCommand,
  decodeScreensaverActiveCommand,
  decodeVisionAnalysisCommand,
  decodeBrokenPhotoCommand,
  decodePhotoMetadataCommand,
  decodePhotoRatingCommand,
  PHOTO_PATCH_COMMAND_ROUTE_SPECS,
  createPoolPatchCommandRouteSpecs,
  SOCKET_ASYNC_JOB_COMMAND_SPECS,
  SOCKET_DURABLE_COMMAND_SPECS,
  SOCKET_SECRET_COMMAND_SPECS,
  decodeTumblrApiKeyCommand,
  decodeStatePatchCommand,
  decodeUseApiTokenCommand,
  REST_ADMIN_SECRET_ROUTE_SPECS,
  REST_ASYNC_JOB_ROUTE_SPECS,
  REST_ADVANCE_PHOTO_ROUTE_SPECS,
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
