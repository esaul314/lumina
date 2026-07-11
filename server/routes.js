// @ts-check

const os = require('os');
const { resolveActiveLocation, fetchWeatherForecast } = require('./services/weather.js');
const googlePhotos = require('./services/googlePhotos.js');
const {
  decodeAddPoolCommand,
  decodeActivePhotoCommand,
  decodeAdvancePhotoCommand,
  decodeCategorySelectionFromHttp,
  decodeDeletePoolCommand,
  decodePoolFeedConfigCommand,
  decodePoolKeywordsCommand,
  decodeBrokenPhotoCommand,
  decodePhotoCropCommand,
  decodePhotoPreventPairingCommand,
  decodePhotoRatingCommand,
  decodeRecrawlCommand,
  decodeTumblrApiKeyCommand,
  decodeUseApiTokenCommand,
  decodeVisionAnalysisCommand,
  decodeScreensaverActiveCommand,
  decodeStatePatchCommand
} = require('./domain/commands.js');
const {
  buildBalancedFeed,
  findPhotoInFeed,
  getPhotoByUrl,
  normalizeCategorySelection
} = require('./domain/selectors.js');

const DEFAULT_CATEGORY = 'Scenic Nature';
const GOOGLE_PHOTOS_CATEGORY = 'Google Photos';
const DEFAULT_GOOGLE_WIDTH = 2560;
const DEFAULT_GOOGLE_HEIGHT = 1440;

/**
 * @typedef {{
 *   reducerResult?: {
 *     events?: Array<{ type: string }>,
 *     effects?: Array<{ type: string }>
 *   },
 *   effectResults?: Array<{ effect?: { type?: string }, value?: any }>
 * }} DispatchResult
 */

/**
 * @typedef {{
 *   app: import('express').Express,
 *   state: Record<string, any>,
 *   collections: Record<string, any[]>,
 *   getWeatherData: () => any,
 *   setWeatherData: (data: any) => void,
 *   io: { emit: (event: string, payload: any) => void },
 *   port: number,
 *   dispatchCommand?: (command: Record<string, any>) => Promise<DispatchResult | null>,
 *   broadcastStateSync?: () => void
 * }} RoutesEnvironment
 */

const toErrorMessage = (error) => error instanceof Error ? error.message : String(error);
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const resolveRouteValue = (value, context) => (typeof value === 'function' ? value(context) : value);
const normalizeMediaDimension = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

function getLocalIpAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface?.family === 'IPv4' && !iface.internal)
    .map((iface) => iface.address);
}

function didDispatchChange(result) {
  return Boolean(
    result
    && (
      (result.reducerResult?.events?.length || 0) > 0
      || (result.reducerResult?.effects?.length || 0) > 0
    )
  );
}

module.exports = function configureRoutes({
  app,
  state,
  collections,
  getWeatherData,
  setWeatherData,
  io,
  port,
  dispatchCommand,
  broadcastStateSync
}) {
  const sendSuccess = (res, status, body = {}) => res.status(status).json({
    success: true,
    ...body
  });
  const sendError = (res, status, error, extra = {}) => res.status(status).json({
    error,
    ...extra
  });
  const sendRouteFailure = (res, failure, context) => sendError(
    res,
    failure.status,
    resolveRouteValue(failure.error, context),
    resolveRouteValue(failure.extra, context) || {}
  );
  const buildStateResponse = () => ({
    ...state,
    currentFrame: state.currentFrame || null,
    config: state.config || null,
    runtime: state.runtime || null,
    library: state.library || null,
    playback: state.playback || null
  });
  const broadcast = () => {
    if (typeof broadcastStateSync === 'function') {
      broadcastStateSync();
      return;
    }
    io.emit('state-sync', state);
  };
  const requireDispatcher = (res, message = 'Dispatcher unavailable.') => {
    if (typeof dispatchCommand === 'function') {
      return true;
    }

    sendError(res, 501, message);
    return false;
  };
  const buildExternalCollections = () => ({
    [GOOGLE_PHOTOS_CATEGORY]: googlePhotos.getCachedMediaItems().map((photo) => ({
      ...photo,
      category: GOOGLE_PHOTOS_CATEGORY
    }))
  });
  const getSelectedCategories = (input = state.currentCategory) => normalizeCategorySelection(
    input,
    Object.keys(collections),
    Object.keys(collections)[0] || DEFAULT_CATEGORY
  );
  const buildFeedForCategories = (selectedCategories) => buildBalancedFeed({
    selectedCategories,
    collections,
    externalCollections: buildExternalCollections(),
    excludedKeywords: state.excludedKeywords
  });
  const getVisibleFeed = () => {
    const photos = buildFeedForCategories(getSelectedCategories());
    if (photos.length > 0) {
      return photos;
    }

    return buildFeedForCategories([Object.keys(collections)[0] || DEFAULT_CATEGORY]);
  };
  const hasPool = (name) => Boolean(name && collections[name]);
  const hasPoolConfig = (name) => Boolean(name && state.searchKeywords?.[name]);
  const createRouteFailure = (status, error, extra = {}) => ({ status, error, extra });
  const createRouteDecodeSuccess = (value) => ({ routeDecode: true, ok: true, value });
  const createRouteDecodeFailure = (status, error, extra = {}) => ({
    routeDecode: true,
    ok: false,
    failure: createRouteFailure(status, error, extra)
  });
  const normalizeRouteDecodeResult = (decoded) => (
    decoded?.routeDecode ? decoded : createRouteDecodeSuccess(decoded)
  );
  const buildPoolResponse = (name) => ({
    name,
    keywords: (state.searchKeywords && state.searchKeywords[name]) || [],
    feedConfigs: (state.feedConfigs && state.feedConfigs[name]) || {},
    photosCount: Array.isArray(collections[name]) ? collections[name].length : 0
  });
  const findKnownPhoto = (url, fallbackPhoto = null) => (
    findPhotoInFeed(state.photosList, url)
    || getPhotoByUrl(collections, url, buildExternalCollections())
    || fallbackPhoto
    || null
  );
  const ensurePoolExists = (name, status = 404) => (
    hasPool(name)
      ? null
      : createRouteFailure(status, `Pool "${name}" not found.`)
  );
  const ensurePoolKnown = (name, status = 404) => (
    hasPool(name) || hasPoolConfig(name)
      ? null
      : createRouteFailure(status, `Pool "${name}" not found.`)
  );
  const ensurePoolMissing = (name) => (
    hasPool(name) || hasPoolConfig(name)
      ? createRouteFailure(409, `Pool "${name}" already exists.`)
      : null
  );
  const ensureKnownPhoto = (url, status = 404) => (
    findKnownPhoto(url)
      ? null
      : createRouteFailure(status, 'Photo URL not found in available photo collections.')
  );
  const respondWithState = (res, status, body = {}) => sendSuccess(res, status, {
    ...body,
    state: buildStateResponse()
  });
  const dispatchAll = async (commands) => {
    const results = [];
    let changed = false;

    for (const command of commands) {
      const result = await dispatchCommand(command);
      results.push(result);
      changed = changed || didDispatchChange(result);
    }

    return { results, changed };
  };
  const getEffectValue = (result, effectType) => result?.effectResults?.find((entry) => entry.effect?.type === effectType)?.value;
  const createAsyncRoute = (handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      sendError(res, 500, toErrorMessage(error));
    }
  };
  const runRouteGuards = (guards, context) => (
    guards.reduce((failure, guard) => failure || guard(context), null)
  );
  const createCommandRoute = ({
    decode,
    present,
    status = 200,
    invalidMessage = 'Invalid request.',
    notFoundMessage = 'Requested resource not found.',
    notFoundStatus = 404,
    allowNoop = false,
    send = sendSuccess,
    unavailableMessage = 'Dispatcher unavailable.',
    guards = []
  }) => createAsyncRoute(async (req, res) => {
    if (!requireDispatcher(res, unavailableMessage)) {
      return;
    }

    const decodedResult = normalizeRouteDecodeResult(decode(req));
    if (!decodedResult.ok) {
      sendRouteFailure(res, decodedResult.failure, { req });
      return;
    }

    const command = decodedResult.value;
    if (!command) {
      sendError(res, 400, invalidMessage);
      return;
    }

    const context = { req, command };
    const guardFailure = runRouteGuards(guards, context);
    if (guardFailure) {
      sendRouteFailure(res, guardFailure, context);
      return;
    }

    const result = await dispatchCommand(command);
    if (!allowNoop && !didDispatchChange(result)) {
      sendError(res, notFoundStatus, resolveRouteValue(notFoundMessage, { ...context, result }));
      return;
    }

    send(res, status, present({ ...context, result }));
  });
  const createBatchCommandRoute = ({
    decode,
    present,
    status = 200,
    invalidMessage = 'Invalid request.',
    notFoundMessage = 'Requested resource not found.',
    notFoundStatus = 404,
    allowNoop = false,
    emptyStatus = 400,
    emptyMessage = invalidMessage,
    unavailableMessage = 'Dispatcher unavailable.',
    guards = []
  }) => createAsyncRoute(async (req, res) => {
    if (!requireDispatcher(res, unavailableMessage)) {
      return;
    }

    const decodedResult = normalizeRouteDecodeResult(decode(req));
    if (!decodedResult.ok) {
      sendRouteFailure(res, decodedResult.failure, { req });
      return;
    }

    const decoded = decodedResult.value;
    if (!decoded) {
      sendError(res, 400, invalidMessage);
      return;
    }

    if (decoded.commands.length === 0 && !allowNoop) {
      sendError(res, emptyStatus, emptyMessage);
      return;
    }

    const context = { req, decoded };
    const guardFailure = runRouteGuards(guards, context);
    if (guardFailure) {
      sendRouteFailure(res, guardFailure, context);
      return;
    }

    const batchResult = await dispatchAll(decoded.commands);
    if (!allowNoop && !batchResult.changed) {
      sendError(res, notFoundStatus, resolveRouteValue(notFoundMessage, { ...context, batchResult }));
      return;
    }

    sendSuccess(res, status, present({
      ...context,
      results: batchResult.results,
      changed: batchResult.changed
    }));
  });
  const decodePhotoPatchRequest = (req) => {
    const body = isObject(req.body) ? req.body : null;
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url) {
      return createRouteDecodeFailure(400, 'Invalid parameter: "url" must be a non-empty string.');
    }

    const commands = [];
    const responsePhoto = { url };

    if (body.rating !== undefined) {
      const ratingCommand = decodePhotoRatingCommand({ url, rating: body.rating });
      if (!ratingCommand) {
        return null;
      }
      commands.push(ratingCommand);
      responsePhoto.rating = ratingCommand.payload.rating;
    }

    if (body.isBroken === true) {
      commands.push(decodeBrokenPhotoCommand({ url }));
      responsePhoto.isBroken = true;
      responsePhoto.rating = 1;
    }

    if (body.cropPercent !== undefined || body.cropPositionY !== undefined) {
      const cropCommand = decodePhotoCropCommand({
        url,
        cropPercent: body.cropPercent,
        cropPositionY: body.cropPositionY
      });
      if (!cropCommand) {
        return null;
      }
      commands.push(cropCommand);
      if (cropCommand.payload.cropPercent !== undefined) {
        responsePhoto.cropPercent = cropCommand.payload.cropPercent;
      }
      if (cropCommand.payload.cropPositionY !== undefined) {
        responsePhoto.cropPositionY = cropCommand.payload.cropPositionY;
      }
    }

    if (body.preventPairing !== undefined) {
      const preventPairingCommand = decodePhotoPreventPairingCommand({
        url,
        preventPairing: body.preventPairing,
        preserveActive: body.preserveActive
      });
      if (!preventPairingCommand) {
        return null;
      }
      commands.push(preventPairingCommand);
      responsePhoto.preventPairing = preventPairingCommand.payload.preventPairing;
    }

    return {
      commands,
      responsePhoto
    };
  };
  const decodePoolPatchRequest = (req) => {
    const name = req.params.name.trim();
    const feedConfigs = req.body?.feedConfigs;
    if (
      feedConfigs !== undefined
      && (
        !isObject(feedConfigs)
      )
    ) {
      return null;
    }

    const commands = [
      req.body?.keywords !== undefined
        ? decodePoolKeywordsCommand({ name, keywords: req.body.keywords })
        : null,
      ...Object.entries(feedConfigs || {}).map(([source, config]) =>
        decodePoolFeedConfigCommand({ name, source, config })
      )
    ].filter(Boolean);

    const expectedCount = (req.body?.keywords !== undefined ? 1 : 0) + Object.keys(feedConfigs || {}).length;
    if (commands.length !== expectedCount) {
      return null;
    }

    return {
      name,
      commands
    };
  };
  const decodeKeywordConfigRequest = (req) => {
    const category = typeof req.body?.category === 'string' ? req.body.category.trim() : '';
    if (!category) {
      return createRouteDecodeFailure(400, 'Invalid parameter: "category" must be a non-empty string.');
    }

    const command = decodePoolKeywordsCommand({
      name: category,
      keywords: req.body?.keywords
    });

    return command
      ? createRouteDecodeSuccess(command)
      : createRouteDecodeFailure(400, 'Invalid parameter: "keywords" must be an array of strings or time-based keyword objects.');
  };
  const createEffectSubmissionRoute = ({
    decode,
    effectType,
    present,
    status = 202,
    invalidMessage = 'Invalid request.',
    unavailableMessage = 'Dispatcher unavailable.',
    missingSubmissionMessage = 'Requested async effect service unavailable.',
    isSubmitted = (submission) => Boolean(submission?.job),
    guards = []
  }) => createAsyncRoute(async (req, res) => {
    if (!requireDispatcher(res, unavailableMessage)) {
      return;
    }

    const decodedResult = normalizeRouteDecodeResult(decode(req));
    if (!decodedResult.ok) {
      sendRouteFailure(res, decodedResult.failure, { req });
      return;
    }

    const command = decodedResult.value;
    if (!command) {
      sendError(res, 400, invalidMessage);
      return;
    }

    const context = { req, command };
    const guardFailure = runRouteGuards(guards, context);
    if (guardFailure) {
      sendRouteFailure(res, guardFailure, context);
      return;
    }

    const result = await dispatchCommand(command);
    const submission = getEffectValue(result, effectType);
    if (!isSubmitted(submission, result, command)) {
      sendError(res, 503, resolveRouteValue(missingSubmissionMessage, { ...context, result, submission }));
      return;
    }

    sendSuccess(res, status, present({ ...context, result, submission }));
  });
  const decodePreviewPhotoRequest = (req) => {
    const command = decodeActivePhotoCommand(req.body);
    if (!command) {
      return createRouteDecodeFailure(400, 'Invalid parameter: "url" must be a non-empty string.');
    }

    const payloadPhoto = command.payload.photo && typeof command.payload.photo === 'object'
      ? command.payload.photo
      : null;
    const foundPhoto = findKnownPhoto(command.payload.url, payloadPhoto);

    if (!foundPhoto) {
      return createRouteDecodeFailure(404, 'Photo URL not found in active feed or curated collections.');
    }

    return createRouteDecodeSuccess({
      ...command,
      payload: {
        ...command.payload,
        photo: foundPhoto
      }
    });
  };
  const refreshActiveFeed = () => {
    state.photosList = getVisibleFeed();
  };

  function startPickerSessionPoller(sessionId) {
    const startTime = Date.now();
    const intervalId = setInterval(async () => {
      if (Date.now() - startTime > 300000) {
        console.log(`Google Picker Poller: Session ${sessionId} timed out.`);
        clearInterval(intervalId);
        try {
          await googlePhotos.deletePickerSession(sessionId);
        } catch (error) {
          console.error(`Google Picker Poller: Failed to delete timed out session ${sessionId}:`, error.message);
        }
        return;
      }

      try {
        const session = await googlePhotos.getPickerSession(sessionId);
        if (!session.mediaItemsSet) {
          return;
        }

        console.log(`Google Picker Poller: Session ${sessionId} completed. Syncing items...`);
        clearInterval(intervalId);

        await googlePhotos.syncGoogleAlbum(sessionId);

        if (getSelectedCategories().includes(GOOGLE_PHOTOS_CATEGORY)) {
          refreshActiveFeed();
        }

        broadcast();
        console.log(`Google Picker Poller: Session ${sessionId} completed and cached successfully.`);
      } catch (error) {
        console.error(`Google Picker Poller error for session ${sessionId}:`, error.message);
        clearInterval(intervalId);
      }
    }, 3000);
  }

  app.get('/api/weather', async (_req, res) => {
    const cached = getWeatherData();
    if (cached) {
      res.json(cached);
      return;
    }

    try {
      const location = await resolveActiveLocation(state);
      const weatherData = await fetchWeatherForecast(location.lat, location.lon);
      const finalData = {
        location,
        current: weatherData.current,
        daily: weatherData.daily
      };

      setWeatherData(finalData);
      res.json(finalData);
    } catch (error) {
      sendError(res, 500, 'Failed to fetch weather data', { message: toErrorMessage(error) });
    }
  });

  app.get('/api/google-photos/media/:mediaItemId', async (req, res) => {
    try {
      const media = await googlePhotos.fetchMediaItemBytes(req.params.mediaItemId, {
        width: normalizeMediaDimension(req.query.w, DEFAULT_GOOGLE_WIDTH),
        height: normalizeMediaDimension(req.query.h, DEFAULT_GOOGLE_HEIGHT),
        crop: req.query.c === '1'
      });

      res.setHeader('Content-Type', media.contentType);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.send(media.buffer);
    } catch (error) {
      sendError(res, 502, 'Failed to proxy Google Photos media item.', { message: toErrorMessage(error) });
    }
  });

  app.get('/api/photos', createAsyncRoute(async (req, res) => {
    if (req.query.category) {
      if (!requireDispatcher(res, 'Category selection dispatcher unavailable.')) {
        return;
      }

      const command = decodeCategorySelectionFromHttp(req.query);
      if (command) {
        await dispatchCommand(command);
      }
    }

    res.json(getVisibleFeed());
  }));

  app.post('/api/photos/rate', createCommandRoute({
    decode: (req) => decodePhotoRatingCommand(req.body),
    invalidMessage: 'Invalid parameter: "url" must be a non-empty string and "rating" must be an integer between 1 and 10.',
    notFoundMessage: 'Photo URL not found in curated collections.',
    present: ({ command }) => ({
      url: command.payload.url,
      rating: command.payload.rating
    })
  }));

  app.post('/api/config/keywords', createCommandRoute({
    decode: decodeKeywordConfigRequest,
    unavailableMessage: 'Keyword dispatcher unavailable.',
    allowNoop: true,
    guards: [
      ({ command }) => ensurePoolExists(command.payload.name)
    ],
    present: ({ command }) => ({
      category: command.payload.name,
      keywords: state.searchKeywords?.[command.payload.name] || []
    })
  }));

  app.post('/api/auth/google/credentials', createAsyncRoute(async (req, res) => {
    const { clientId, clientSecret } = req.body;
    if (!clientId || !clientSecret) {
      sendError(res, 400, 'Client ID and Client Secret are required.');
      return;
    }

    sendSuccess(res, 200, {
      success: googlePhotos.saveGoogleCredentials(clientId, clientSecret)
    });
  }));

  app.get('/api/auth/google/login', (req, res) => {
    const host = req.headers.host || `localhost:${port}`;
    const redirectUri = `http://${host}/api/auth/google/callback`;
    res.redirect(googlePhotos.getGoogleAuthUrl(redirectUri));
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
      res.status(400).send('Authentication code is missing from Google redirect.');
      return;
    }

    try {
      const host = req.headers.host || `localhost:${port}`;
      const redirectUri = `http://${host}/api/auth/google/callback`;
      await googlePhotos.exchangeGoogleCode(code, redirectUri);

      const session = await googlePhotos.createPickerSession();
      startPickerSessionPoller(session.id);

      res.redirect(`${session.pickerUri}/autoclose`);
    } catch (error) {
      console.error('Google Photos Auth Callback error:', toErrorMessage(error));
      res.status(500).send(`Google Photos Link Failed: ${toErrorMessage(error)}`);
    }
  });

  app.get('/api/auth/google/sandbox-callback', async (req, res) => {
    try {
      await googlePhotos.exchangeGoogleCode('sandbox-code', '');
      const session = await googlePhotos.createPickerSession();
      await googlePhotos.syncGoogleAlbum(session.id);

      if (getSelectedCategories().includes(GOOGLE_PHOTOS_CATEGORY)) {
        refreshActiveFeed();
      }
      broadcast();

      const host = req.headers.host || `localhost:${port}`;
      res.redirect(`http://${host}/?mode=remote&googleAuth=success`);
    } catch (error) {
      res.status(500).send(`Sandbox Google Photos Link Failed: ${toErrorMessage(error)}`);
    }
  });

  app.get('/api/config', (_req, res) => {
    res.json({
      localIps: getLocalIpAddresses(),
      port,
      state: buildStateResponse()
    });
  });

  app.get('/api/state', (_req, res) => {
    res.json(buildStateResponse());
  });

  app.post('/api/state/categories', createCommandRoute({
    decode: (req) => decodeCategorySelectionFromHttp(req.body),
    invalidMessage: 'Invalid parameter: "categories" must be a non-empty string or array.',
    unavailableMessage: 'Category selection dispatcher unavailable.',
    present: () => ({
      state: buildStateResponse()
    })
  }));

  app.patch('/api/state', createCommandRoute({
    decode: (req) => decodeStatePatchCommand(req.body),
    invalidMessage: 'Invalid state patch payload.',
    allowNoop: true,
    send: (res, _status, body) => res.json(body),
    present: () => buildStateResponse()
  }));

  app.post('/api/state/screensaver', createCommandRoute({
    decode: (req) => decodeScreensaverActiveCommand(req.body),
    invalidMessage: 'Invalid parameter: "active" must be a boolean.',
    present: () => ({
      screensaverActive: state.screensaverActive,
      state: buildStateResponse()
    })
  }));

  const createAdminSecretRoute = (path, secretName, decode) => app.post(path, createCommandRoute({
    decode: (req) => decode(req.body),
    invalidMessage: 'Invalid admin secret payload.',
    unavailableMessage: 'Admin secret dispatcher unavailable.',
    present: ({ command }) => ({
      secret: secretName,
      configured: Boolean(command.payload?.value),
      state: buildStateResponse()
    })
  }));

  createAdminSecretRoute('/api/admin/secrets/useapi-token', 'useapi-token', decodeUseApiTokenCommand);
  createAdminSecretRoute('/api/admin/secrets/tumblr-api-key', 'tumblr-api-key', decodeTumblrApiKeyCommand);

  app.post('/api/jobs/recrawl', createEffectSubmissionRoute({
    decode: (req) => decodeRecrawlCommand(req.body),
    effectType: 'start-recrawl-job',
    invalidMessage: 'Invalid recrawl payload.',
    unavailableMessage: 'Recrawl dispatcher unavailable.',
    missingSubmissionMessage: 'Recrawl job service unavailable.',
    present: ({ submission }) => ({
      job: submission.job,
      reused: Boolean(submission.reused)
    })
  }));

  app.post('/api/jobs/vision-analysis', createEffectSubmissionRoute({
    decode: (req) => decodeVisionAnalysisCommand(req.body),
    effectType: 'start-vision-analysis-job',
    invalidMessage: 'Invalid vision-analysis payload.',
    unavailableMessage: 'Vision-analysis dispatcher unavailable.',
    missingSubmissionMessage: 'Vision-analysis job service unavailable.',
    present: ({ submission }) => ({
      job: submission.job,
      reused: Boolean(submission.reused)
    })
  }));

  app.get('/api/pools', (_req, res) => {
    res.json(Object.keys(collections).map(buildPoolResponse));
  });

  app.post('/api/pools', createCommandRoute({
    decode: (req) => decodeAddPoolCommand(req.body),
    invalidMessage: 'Invalid pool payload. Provide a non-empty "name" and at least one keyword.',
    unavailableMessage: 'Pool dispatcher unavailable.',
    status: 201,
    guards: [
      ({ command }) => ensurePoolMissing(command.payload.name)
    ],
    notFoundMessage: ({ command }) => `Pool "${command.payload.name}" could not be created.`,
    send: respondWithState,
    present: ({ command }) => ({
      pool: buildPoolResponse(command.payload.name)
    })
  }));

  app.delete('/api/pools/:name', createCommandRoute({
    decode: (req) => decodeDeletePoolCommand({ name: req.params.name }),
    invalidMessage: 'Invalid pool name.',
    unavailableMessage: 'Pool dispatcher unavailable.',
    guards: [
      ({ command }) => ensurePoolKnown(command.payload.name)
    ],
    notFoundMessage: ({ command }) => `Pool "${command.payload.name}" not found.`,
    send: respondWithState,
    present: ({ command }) => ({
      message: `Pool "${command.payload.name}" deleted successfully.`
    })
  }));

  app.patch('/api/pools/:name', createBatchCommandRoute({
    decode: decodePoolPatchRequest,
    invalidMessage: 'Invalid pool patch payload.',
    notFoundMessage: 'Pool patch did not modify any existing state.',
    allowNoop: true,
    unavailableMessage: 'Pool dispatcher unavailable.',
    guards: [
      ({ decoded }) => ensurePoolExists(decoded.name)
    ],
    present: ({ decoded }) => ({
      state: buildStateResponse(),
      pool: buildPoolResponse(decoded.name)
    })
  }));

  app.patch('/api/pools/:name/feed-sources/:source', createCommandRoute({
    decode: (req) => decodePoolFeedConfigCommand({
      name: req.params.name,
      source: req.params.source,
      config: req.body
    }),
    invalidMessage: 'Invalid feed source patch payload.',
    unavailableMessage: 'Pool dispatcher unavailable.',
    guards: [
      ({ command }) => ensurePoolExists(command.payload.name)
    ],
    notFoundMessage: ({ command }) => `Pool "${command.payload.name}" not found.`,
    send: respondWithState,
    present: ({ command }) => ({
      pool: buildPoolResponse(command.payload.name),
      feedSource: command.payload.source
    })
  }));

  app.post('/api/pools/:name/crawl', createEffectSubmissionRoute({
    decode: (req) => ({
      type: 'trigger-recrawl',
      payload: {
        categories: [req.params.name.trim()]
      }
    }),
    effectType: 'start-recrawl-job',
    unavailableMessage: 'Recrawl dispatcher unavailable.',
    missingSubmissionMessage: 'Recrawl job service unavailable.',
    guards: [
      ({ req }) => ensurePoolExists(req.params.name.trim())
    ],
    present: ({ req, submission }) => ({
      pool: buildPoolResponse(req.params.name.trim()),
      job: submission.job,
      reused: Boolean(submission.reused)
    })
  }));

  app.get('/api/pools/:name/photos', (req, res) => {
    const name = req.params.name.trim();
    if (!collections[name]) {
      sendError(res, 404, `Pool "${name}" not found.`);
      return;
    }

    res.json(collections[name]);
  });

  app.patch('/api/photos', createBatchCommandRoute({
    decode: decodePhotoPatchRequest,
    invalidMessage: 'Invalid photo patch payload.',
    notFoundMessage: 'Photo URL not found in available photo collections.',
    emptyStatus: 404,
    emptyMessage: 'Photo URL not found in available photo collections.',
    guards: [
      ({ decoded }) => ensureKnownPhoto(decoded.responsePhoto.url)
    ],
    present: ({ decoded }) => ({
      photo: decoded.responsePhoto
    })
  }));

  app.post('/api/photos/preview', createCommandRoute({
    decode: decodePreviewPhotoRequest,
    unavailableMessage: 'Preview dispatcher unavailable.',
    present: () => ({
      activePhoto: state.activePhoto
    })
  }));

  const createAdvanceRoute = (direction) => createCommandRoute({
    decode: () => decodeAdvancePhotoCommand(direction, 'sequence'),
    notFoundMessage: `Could not transition to ${direction === 'next' ? 'next' : 'previous'} photo.`,
    notFoundStatus: 500,
    present: () => ({
      activePhoto: state.activePhoto
    })
  });

  app.post('/api/photos/next', createAdvanceRoute('next'));
  app.post('/api/photos/prev', createAdvanceRoute('prev'));
};
