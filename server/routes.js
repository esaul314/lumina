// @ts-check

const os = require('os');
const { resolveActiveLocation, fetchWeatherForecast } = require('./services/weather.js');
const googlePhotos = require('./services/googlePhotos.js');
const {
  decodeAddPoolCommand,
  decodeActivePhotoCommand,
  decodeCategorySelectionFromHttp,
  decodeDeletePoolCommand,
  decodePoolFeedConfigCommand,
  decodePoolKeywordsCommand,
  decodePhotoRatingCommand,
  decodePoolScopedRecrawlCommand,
  PHOTO_PATCH_COMMAND_ROUTE_SPECS,
  REST_ADMIN_SECRET_ROUTE_SPECS,
  REST_ASYNC_JOB_ROUTE_SPECS,
  REST_ADVANCE_PHOTO_ROUTE_SPECS,
  createPoolPatchCommandRouteSpecs,
  decodeScreensaverActiveCommand,
  decodeStatePatchCommand
} = require('./domain/commands.js');
const {
  buildBalancedFeed,
  findPhotoInFeed,
  getPhotoByUrl,
  normalizeCategorySelection
} = require('./domain/selectors.js');
const {
  chainRouteDecode,
  collectRouteDecodeResults,
  createRouteDecodeFailure,
  createRouteDecodeSuccess,
  createRouteFailure,
  mapRouteDecode,
  normalizeRouteDecodeResult
} = require('./utils/routeDecode.js');

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
 *   getEnvironmentData?: () => Promise<Record<string, unknown>>,
 *   io: { emit: (event: string, payload: any) => void },
 *   port: number,
 *   dispatchCommand?: (command: Record<string, any>) => Promise<DispatchResult | null>,
 *   broadcastStateSync?: () => void
 * }} RoutesEnvironment
 */

const toErrorMessage = (error) => error instanceof Error ? error.message : String(error);
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const resolveRouteValue = (value, context) => (typeof value === 'function' ? value(context) : value);
const compact = (values) => values.filter((value) => value !== null && value !== undefined);
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
  getEnvironmentData = async () => ({ indoor: null, source: 'ecowitt-gw1200', observedAt: null, stale: false, enabled: false }),
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
  const decodeCommandOrFailure = (command, status, error, extra = {}) => (
    command
      ? createRouteDecodeSuccess(command)
      : createRouteDecodeFailure(status, error, extra)
  );
  const decodeOptionalCommandPart = ({
    active,
    command,
    error,
    status = 400,
    extra = {},
    responsePatch = () => ({})
  }) => (
    !active
      ? createRouteDecodeSuccess(null)
      : mapRouteDecode((decodedCommand) => ({
          command: decodedCommand,
          responsePatch: responsePatch(decodedCommand)
        }))(decodeCommandOrFailure(command, status, error, extra))
  );
  const decodeOptionalCommandSpec = (context) => (spec) => decodeOptionalCommandPart({
    active: resolveRouteValue(spec.active, context),
    command: resolveRouteValue(spec.decode, context),
    error: resolveRouteValue(spec.error, context),
    status: resolveRouteValue(spec.status, context) ?? 400,
    extra: resolveRouteValue(spec.extra, context) || {},
    responsePatch: (command) => (
      resolveRouteValue(spec.responsePatch, { ...context, command }) || {}
    )
  });
  const decodeCommandSpecs = (context, specs) => mapRouteDecode(buildCommandParts)(
    collectRouteDecodeResults(specs.map(decodeOptionalCommandSpec(context)))
  );
  const buildCommandParts = (parts) => ({
    commands: compact(parts.map((part) => part?.command)),
    responsePatch: parts.reduce((patch, part) => (
      part ? { ...patch, ...part.responsePatch } : patch
    ), {})
  });
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
  const registerRouteSpecs = (specs, buildRoute, defaultMethod = 'post') => {
    specs.forEach((spec) => {
      app[spec.method || defaultMethod](spec.path, buildRoute(spec));
    });
  };
  const createDispatchRoute = ({
    decode,
    present,
    buildPlan,
    status = 200,
    invalidMessage = 'Invalid request.',
    send = sendSuccess,
    unavailableMessage = 'Dispatcher unavailable.'
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

    const plan = buildPlan({ req, decoded });
    const context = plan.context || { req, decoded };
    const guardFailure = runRouteGuards(plan.guards || [], context);
    if (guardFailure) {
      sendRouteFailure(res, guardFailure, context);
      return;
    }

    const preflightFailure = plan.preflight ? plan.preflight(context) : null;
    if (preflightFailure) {
      sendRouteFailure(res, preflightFailure, context);
      return;
    }

    const dispatchOutcome = await plan.run(context);
    const finalContext = {
      ...context,
      ...dispatchOutcome
    };
    const failure = plan.validate ? plan.validate(finalContext) : null;
    if (failure) {
      sendRouteFailure(res, failure, finalContext);
      return;
    }

    send(res, status, present(finalContext));
  });
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
  }) => createDispatchRoute({
    decode,
    present,
    status,
    invalidMessage,
    send,
    unavailableMessage,
    buildPlan: ({ req, decoded: command }) => ({
      context: { req, command },
      guards,
      run: async ({ command }) => ({
        result: await dispatchCommand(command)
      }),
      validate: ({ result }) => (
        !allowNoop && !didDispatchChange(result)
          ? createRouteFailure(notFoundStatus, notFoundMessage)
          : null
      )
    })
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
  }) => createDispatchRoute({
    decode,
    present,
    status,
    invalidMessage,
    unavailableMessage,
    buildPlan: ({ req, decoded }) => ({
      context: { req, decoded },
      guards,
      preflight: ({ decoded }) => (
        decoded.commands.length === 0 && !allowNoop
          ? createRouteFailure(emptyStatus, emptyMessage)
          : null
      ),
      run: async ({ decoded }) => {
        const batchResult = await dispatchAll(decoded.commands);
        return {
          batchResult,
          results: batchResult.results,
          changed: batchResult.changed
        };
      },
      validate: ({ batchResult }) => (
        (
          !allowNoop && !batchResult.changed
            ? createRouteFailure(notFoundStatus, notFoundMessage)
            : null
        )
      )
    })
  });
  const decodePhotoPatchRequest = (req) => {
    const body = isObject(req.body) ? req.body : null;
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url) {
      return createRouteDecodeFailure(400, 'Invalid parameter: "url" must be a non-empty string.');
    }

    return mapRouteDecode(({ commands, responsePatch }) => ({
      commands,
      responsePhoto: {
        url,
        ...responsePatch
      }
    }))(decodeCommandSpecs({ body, url }, PHOTO_PATCH_COMMAND_ROUTE_SPECS));
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
      return createRouteDecodeFailure(400, 'Invalid parameter: "feedConfigs" must be an object keyed by source.');
    }

    return mapRouteDecode(({ commands }) => ({
      name,
      commands
    }))(decodeCommandSpecs(
      { body: req.body, feedConfigs, name },
      createPoolPatchCommandRouteSpecs({ feedConfigs })
    ));
  };
  const decodeKeywordConfigRequest = (req) => {
    const category = typeof req.body?.category === 'string' ? req.body.category.trim() : '';
    if (!category) {
      return createRouteDecodeFailure(400, 'Invalid parameter: "category" must be a non-empty string.');
    }

    return decodeCommandOrFailure(
      decodePoolKeywordsCommand({
        name: category,
        keywords: req.body?.keywords
      }),
      400,
      'Invalid parameter: "keywords" must be an array of strings or time-based keyword objects.'
    );
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
  }) => createDispatchRoute({
    decode,
    present,
    status,
    invalidMessage,
    unavailableMessage,
    buildPlan: ({ req, decoded: command }) => ({
      context: { req, command },
      guards,
      run: async ({ command }) => {
        const result = await dispatchCommand(command);
        return {
          result,
          submission: getEffectValue(result, effectType)
        };
      },
      validate: ({ command, result, submission }) => (
        !isSubmitted(submission, result, command)
          ? createRouteFailure(503, missingSubmissionMessage)
          : null
      )
    })
  });
  const decodePreviewPhotoRequest = (req) => {
    return chainRouteDecode((command) => {
      const payloadPhoto = command.payload.photo && typeof command.payload.photo === 'object'
        ? command.payload.photo
        : null;
      const foundPhoto = findKnownPhoto(command.payload.url, payloadPhoto);

      return foundPhoto
        ? createRouteDecodeSuccess({
            ...command,
            payload: {
              ...command.payload,
              photo: foundPhoto
            }
          })
        : createRouteDecodeFailure(404, 'Photo URL not found in active feed or curated collections.');
    })(decodeCommandOrFailure(
      decodeActivePhotoCommand(req.body),
      400,
      'Invalid parameter: "url" must be a non-empty string.'
    ));
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

  app.get('/api/environment', async (_req, res) => {
    try {
      res.json(await getEnvironmentData());
    } catch (error) {
      sendError(res, 503, 'Failed to fetch indoor environment data', { message: toErrorMessage(error) });
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

  const createAdminSecretRoute = ({ decode, secretName, unavailableMessage = 'Admin secret dispatcher unavailable.' }) => createCommandRoute({
    decode: (req) => decode(req.body),
    invalidMessage: 'Invalid admin secret payload.',
    unavailableMessage,
    present: ({ command }) => ({
      secret: secretName,
      configured: Boolean(command.payload?.value),
      state: buildStateResponse()
    })
  });
  const createAsyncJobRoute = ({
    decode,
    effectType,
    present,
    invalidMessage,
    unavailableMessage,
    missingSubmissionMessage
  }) => createEffectSubmissionRoute({
    decode: (req) => decode(req.body),
    effectType,
    invalidMessage,
    unavailableMessage,
    missingSubmissionMessage,
    present
  });
  registerRouteSpecs(REST_ADMIN_SECRET_ROUTE_SPECS, createAdminSecretRoute);
  registerRouteSpecs(REST_ASYNC_JOB_ROUTE_SPECS, createAsyncJobRoute);

  app.get('/api/pools', (_req, res) => {
    res.json(Object.keys(collections).map(buildPoolResponse));
  });

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

  app.post('/api/pools/:name/crawl', createEffectSubmissionRoute({
    decode: (req) => decodePoolScopedRecrawlCommand(req.params.name),
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

  const createAdvanceRoute = ({ decode, notFoundMessage, notFoundStatus }) => createCommandRoute({
    decode,
    notFoundMessage,
    notFoundStatus,
    present: () => ({
      activePhoto: state.activePhoto
    })
  });

  const REST_SINGLE_COMMAND_ROUTE_SPECS = [
    {
      method: 'post',
      path: '/api/photos/rate',
      decode: (req) => decodePhotoRatingCommand(req.body),
      invalidMessage: 'Invalid parameter: "url" must be a non-empty string and "rating" must be an integer between 1 and 10.',
      notFoundMessage: 'Photo URL not found in curated collections.',
      present: ({ command }) => ({
        url: command.payload.url,
        rating: command.payload.rating
      })
    },
    {
      method: 'post',
      path: '/api/config/keywords',
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
    },
    {
      method: 'post',
      path: '/api/state/categories',
      decode: (req) => decodeCategorySelectionFromHttp(req.body),
      invalidMessage: 'Invalid parameter: "categories" must be a non-empty string or array.',
      unavailableMessage: 'Category selection dispatcher unavailable.',
      present: () => ({
        state: buildStateResponse()
      })
    },
    {
      method: 'patch',
      path: '/api/state',
      decode: (req) => decodeStatePatchCommand(req.body),
      invalidMessage: 'Invalid state patch payload.',
      allowNoop: true,
      send: (res, _status, body) => res.json(body),
      present: () => buildStateResponse()
    },
    {
      method: 'post',
      path: '/api/state/screensaver',
      decode: (req) => decodeScreensaverActiveCommand(req.body),
      invalidMessage: 'Invalid parameter: "active" must be a boolean.',
      present: () => ({
        screensaverActive: state.screensaverActive,
        state: buildStateResponse()
      })
    },
    {
      method: 'post',
      path: '/api/pools',
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
    },
    {
      method: 'delete',
      path: '/api/pools/:name',
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
    },
    {
      method: 'patch',
      path: '/api/pools/:name/feed-sources/:source',
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
    },
    {
      method: 'post',
      path: '/api/photos/preview',
      decode: decodePreviewPhotoRequest,
      unavailableMessage: 'Preview dispatcher unavailable.',
      present: () => ({
        activePhoto: state.activePhoto
      })
    }
  ];

  registerRouteSpecs(REST_SINGLE_COMMAND_ROUTE_SPECS, createCommandRoute);
  registerRouteSpecs(REST_ADVANCE_PHOTO_ROUTE_SPECS, createAdvanceRoute);
};
