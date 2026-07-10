// @ts-check

const { sendEmailAlert } = require('./services/notifier.js');
const googlePhotos = require('./services/googlePhotos.js');
const { getHostDisplayInfo } = require('./services/system.js');
const { createSocketLegacyCompatibility } = require('./socketLegacyCompatibility.js');
const {
  buildBooleanFieldPatch,
  buildEnumFieldPatch,
  buildFiniteNumberFieldPatch,
  buildObjectFieldPatch,
  buildPercentFieldPatch,
  buildTrimmedStringFieldPatch,
  buildWidgetPatch,
  createStatePatchCommandDecoder,
  decodeAddPoolCommand,
  decodeActivePhotoCommand,
  decodeAdvancePhotoCommand,
  decodeCategorySelectionFromSocket,
  decodeDeletePoolCommand,
  decodeExcludedKeywordsCommand,
  decodePoolFeedConfigCommand,
  decodePoolKeywordsCommand,
  decodeBrokenPhotoCommand,
  decodePhotoCropCommand,
  decodePhotoMetadataCommand,
  decodePhotoPreventPairingCommand,
  decodePhotoRatingCommand,
  decodeRecrawlCommand,
  decodeScreensaverActiveCommand,
  decodeTumblrApiKeyCommand,
  decodeUseApiTokenCommand,
  decodeVisionAnalysisCommand,
} = require('./domain/commands.js');

const decodeWidgetCommand = createStatePatchCommandDecoder(buildWidgetPatch);
const decodeAlignTimeCommand = createStatePatchCommandDecoder(buildBooleanFieldPatch('alignTimeOfDay'));
const decodeAlignWeatherCommand = createStatePatchCommandDecoder(buildBooleanFieldPatch('alignWeather'));
const decodeAllowOpenAiFallbackCommand = createStatePatchCommandDecoder(buildBooleanFieldPatch('allowOpenAiFallback'));
const decodeScaleModeCommand = createStatePatchCommandDecoder(buildEnumFieldPatch('scaleMode', ['cover', 'contain']));
const decodeSplitPortraitCommand = createStatePatchCommandDecoder(buildBooleanFieldPatch('splitPortrait'));
const decodeSplitCropCommand = createStatePatchCommandDecoder(buildPercentFieldPatch('splitCropPercent'));
const decodeVisionConfigCommand = createStatePatchCommandDecoder(buildObjectFieldPatch('visionConfig'));
const decodeNightPercentageCommand = createStatePatchCommandDecoder(buildPercentFieldPatch('nightPercentage'));
const decodeIntervalCommand = createStatePatchCommandDecoder(buildFiniteNumberFieldPatch('slideshowInterval'));
const decodeThemeCommand = createStatePatchCommandDecoder(buildTrimmedStringFieldPatch('theme'));
const decodeAutoLocationCommand = createStatePatchCommandDecoder(buildBooleanFieldPatch('autoLocation'));
const decodeManualLocationCommand = createStatePatchCommandDecoder(buildObjectFieldPatch('manualLocation'));
const decodeScreensaverActiveFromSocket = (active) => decodeScreensaverActiveCommand({ active });
const buildSocketErrorLogger = (label) => (error) => {
  console.error(`Socket Event: ${label} failed:`, error.message);
};
const toViewportDimensions = (payload) => ({
  width: Number(payload?.width),
  height: Number(payload?.height)
});
const hasValidViewport = ({ width, height }) => width > 0 && height > 0;
const buildViewportSnapshot = ({ width, height }) => ({
  width,
  height,
  aspectRatio: width / height,
  updatedAt: Date.now()
});
const normalizeFailedUrls = (failedUrls) => Array.isArray(failedUrls) ? failedUrls : [];
const buildMediaFailureAlertBody = ({ category, failedUrls, message }) => (
  `Lumina screensaver client has reported a media loading failure on your smart display.

Category: ${category}

Problem: ${message}

Failed Wallpaper URLs:
${failedUrls.join('\n')}

Action: The client is rate-limiting skips and holding an offline visual boundary. Please check your network connection.`
);

/**
 * @param {{
 *   dispatchCommand?: (command: Record<string, any>) => Promise<any> | any,
 *   decode: (payload: any) => Record<string, any> | null,
 *   fallback?: (command: Record<string, any>, payload: any) => Promise<void> | void,
 *   intercept?: (command: Record<string, any>, payload: any) => Promise<boolean> | boolean,
 *   afterDispatch?: (result: any, command: Record<string, any>, payload: any) => Promise<void> | void,
 *   onError?: (error: Error, command: Record<string, any>, payload: any) => Promise<void> | void
 * }} options
 */
function createCommandListener({ dispatchCommand, decode, fallback, intercept, afterDispatch, onError }) {
  return async (payload) => {
    const command = decode(payload);
    if (!command) {
      return;
    }

    try {
      if (typeof intercept === 'function' && await intercept(command, payload)) {
        return;
      }

      const result = typeof dispatchCommand === 'function'
        ? await dispatchCommand(command)
        : (typeof fallback === 'function' ? await fallback(command, payload) : undefined);

      if (typeof afterDispatch === 'function') {
        await afterDispatch(result, command, payload);
      }
    } catch (error) {
      if (typeof onError === 'function') {
        await onError(error, command, payload);
        return;
      }

      throw error;
    }
  };
}

/**
 * @param {{
 *   handler: (payload: any) => Promise<void> | void,
 *   onError?: (error: Error, payload: any) => Promise<void> | void
 * }} options
 */
function createAsyncListener({ handler, onError }) {
  return async (payload) => {
    try {
      await handler(payload);
    } catch (error) {
      if (typeof onError === 'function') {
        await onError(error, payload);
        return;
      }

      throw error;
    }
  };
}

/**
 * @param {{
 *   label: string,
 *   handler: (payload: any) => Promise<void> | void
 * }} options
 */
function createTelemetryListener({ label, handler }) {
  return createAsyncListener({
    handler,
    onError: buildSocketErrorLogger(label)
  });
}

const registerSocketListeners = (socket, listeners) => listeners.forEach(({ event, handler }) => {
  socket.on(event, handler);
});

/**
 * 🛰️ configureSockets
 * Orchestrates Socket.IO event hooks, synchronizing the smart display
 * client and mobile remote controls in real-time.
 */
module.exports = function configureSockets({
  io,
  state,
  collections,
  combineFeedsBalanced,
  getSmartPhoto,
  launchKioskBrowser,
  killKioskBrowser,
  setManualOverride,
  getLocalIpAddresses,
  port,
  triggerWeatherUpdate,
  dispatchCommand,
  broadcastStateSync,
  getLatestJobs = null,
  notifyMediaFailure = sendEmailAlert,
  resolveTvDisplayInfo = getHostDisplayInfo,
  refreshGooglePhotoUrl = googlePhotos.refreshMediaItemUrl
}) {
  const broadcast = () => {
    if (typeof broadcastStateSync === 'function') {
      return broadcastStateSync();
    }

    io.emit('state-sync', state);
  };
  const compatibility = typeof dispatchCommand === 'function'
    ? null
    : createSocketLegacyCompatibility({
      io,
      state,
      collections,
      combineFeedsBalanced,
      getSmartPhoto,
      launchKioskBrowser,
      killKioskBrowser,
      setManualOverride,
      triggerWeatherUpdate,
      broadcast
    });

  io.on('connection', (socket) => {
    console.log('Device connected to Lumina network:', socket.id);

    // Sync immediately on connect
    socket.emit('state-sync', state);
    socket.emit('ip-info', {
      localIps: getLocalIpAddresses(),
      port
    });

    const latestJobs = typeof getLatestJobs === 'function' ? getLatestJobs() : [];
    latestJobs.filter(Boolean).forEach((job) => {
      socket.emit('job-status', job);
    });

    const emitGooglePhotoRefreshResponse = (mediaItemId, payload) => {
      socket.emit('active-google-photo-response', { mediaItemId, ...payload });
    };

    const listenForCommand = (eventName, decode, fallback, intercept, afterDispatch, onError) => {
      socket.on(eventName, createCommandListener({
        dispatchCommand,
        decode,
        fallback,
        intercept,
        afterDispatch,
        onError
      }));
    };

    const listenForStatePatch = (eventName, decode) => {
      listenForCommand(eventName, decode, compatibility?.statePatch);
    };

    registerSocketListeners(socket, [
      {
        event: 'report-media-failure',
        handler: createTelemetryListener({
          label: 'report-media-failure',
          handler: ({ category, failedUrls, message }) => {
            const normalizedFailedUrls = normalizeFailedUrls(failedUrls);
            console.error(`CLIENT ERROR REPORT: Media loading failed in category "${category}":`, message);
            notifyMediaFailure(
              '🚨 LUMINA CRITICAL ALERT: Display Feed Failure Detected',
              buildMediaFailureAlertBody({
                category,
                failedUrls: normalizedFailedUrls,
                message
              })
            );
          }
        })
      },
      {
        event: 'set-active-second-photo',
        handler: (photo) => {
          state.activeSecondPhoto = photo;
          io.emit('second-photo-update', photo);
        }
      },
      {
        event: 'report-tv-viewport',
        handler: createTelemetryListener({
          label: 'report-tv-viewport',
          handler: async (payload) => {
            const viewport = toViewportDimensions(payload);
            if (!hasValidViewport(viewport)) {
              return;
            }

            state.tvViewport = buildViewportSnapshot(viewport);

            if (!state.tvDisplayInfo) {
              const tvDisplayInfo = await resolveTvDisplayInfo();
              if (tvDisplayInfo) {
                state.tvDisplayInfo = tvDisplayInfo;
              }
            }

            broadcast();
          }
        })
      },
      {
        event: 'get-active-google-photo',
        handler: createAsyncListener({
          handler: async ({ mediaItemId } = {}) => {
            const freshUrl = await refreshGooglePhotoUrl(mediaItemId);
            emitGooglePhotoRefreshResponse(mediaItemId, { url: freshUrl });
          },
          onError: (error, { mediaItemId } = {}) => {
            console.error(`Socket Event: Failed to refresh Google Photo URL for item ${mediaItemId}:`, error.message);
            emitGooglePhotoRefreshResponse(mediaItemId, { error: error.message });
          }
        })
      },
      {
        event: 'disconnect',
        handler: () => {
          console.log('Device disconnected:', socket.id);
        }
      }
    ]);

    listenForStatePatch('toggle-widget', decodeWidgetCommand);
    listenForStatePatch('toggle-align-time', decodeAlignTimeCommand);
    listenForStatePatch('toggle-align-weather', decodeAlignWeatherCommand);
    listenForStatePatch('toggle-allow-openai-fallback', decodeAllowOpenAiFallbackCommand);
    listenForStatePatch('change-scale-mode', decodeScaleModeCommand);
    listenForStatePatch('toggle-split-portrait', decodeSplitPortraitCommand);
    listenForStatePatch('change-split-crop', decodeSplitCropCommand);
    listenForStatePatch('update-vision-config', decodeVisionConfigCommand);
    listenForStatePatch('change-night-percentage', decodeNightPercentageCommand);
    listenForStatePatch('change-interval', decodeIntervalCommand);
    listenForStatePatch('change-theme', decodeThemeCommand);
    listenForStatePatch('toggle-auto-location', decodeAutoLocationCommand);
    listenForStatePatch('update-manual-location', decodeManualLocationCommand);

    // Change Wallpaper category
    listenForCommand('change-category', (category) => {
      console.log(`[SOCKET EVENT] change-category received: "${category}"`);
      return decodeCategorySelectionFromSocket(category);
    }, compatibility?.categorySelection);

    // Change individual active photo
    listenForCommand('set-active-photo', decodeActivePhotoCommand, compatibility?.activePhoto);

    listenForCommand(
      'report-photo-metadata',
      decodePhotoMetadataCommand,
      compatibility?.photoMetadata
    );

    // Rate photo socket event
    listenForCommand(
      'rate-photo',
      decodePhotoRatingCommand,
      compatibility?.photoRating
    );

    // Set individual photo crop ratio and vertical position
    listenForCommand(
      'set-photo-crop',
      decodePhotoCropCommand,
      compatibility?.photoCrop
    );


    // Set individual photo pairing prevention
    listenForCommand(
      'set-photo-prevent-pairing',
      decodePhotoPreventPairingCommand,
      compatibility?.photoPreventPairing
    );

    // Update keywords socket event
    listenForCommand('update-keywords', decodePoolKeywordsCommand, compatibility?.poolKeywords);

    // Update feed config socket event
    listenForCommand('update-feed-config', decodePoolFeedConfigCommand, compatibility?.poolFeedConfig);

    listenForCommand('update-excluded-keywords', decodeExcludedKeywordsCommand, compatibility?.excludedKeywords);

    // Add custom category / scenic pool
    listenForCommand('add-category', decodeAddPoolCommand, compatibility?.addPool);

    // Delete custom category / scenic pool
    listenForCommand('delete-category', decodeDeletePoolCommand, compatibility?.deletePool);

    listenForCommand('next-photo', () => decodeAdvancePhotoCommand('next'), compatibility?.advancePhoto('next'));

    listenForCommand('prev-photo', () => decodeAdvancePhotoCommand('prev'), compatibility?.advancePhoto('prev'));

    listenForCommand('set-screensaver-active', decodeScreensaverActiveFromSocket, compatibility?.screensaverActive);

    listenForCommand(
      'mark-photo-broken',
      (payload) => {
        console.log(`[SOCKET EVENT] mark-photo-broken received for URL: ${payload?.url}`);
        return decodeBrokenPhotoCommand(payload);
      },
      compatibility?.brokenPhoto
    );

    listenForCommand('trigger-recrawl', (payload) => {
      console.log('[SOCKET EVENT] trigger-recrawl received. Initiating manual crawl...');
      return decodeRecrawlCommand(payload);
    }, () => {
      socket.emit('recrawl-complete', { success: false, error: 'Recrawl dispatcher unavailable.' });
    });

    listenForCommand('trigger-vision-analysis', (payload) => {
      console.log('[SOCKET EVENT] trigger-vision-analysis received. Initiating manual vision analysis...');
      return decodeVisionAnalysisCommand(payload);
    }, () => {
      socket.emit('job-status', {
        type: 'vision-analysis',
        status: 'failed',
        error: 'Vision-analysis dispatcher unavailable.'
      });
    });

    const emitSecretSaveResult = (eventName, success, error) => {
      socket.emit(eventName, success ? { success: true } : { success: false, error });
    };

    listenForCommand(
      'save-useapi-token',
      decodeUseApiTokenCommand,
      compatibility?.envSecret({ envKey: 'USEAPI_TOKEN', runtimeFlag: 'hasUseApiToken' }),
      null,
      () => {
        console.log('[SOCKET EVENT] Successfully persisted USEAPI_TOKEN through the shared admin command path');
        emitSecretSaveResult('useapi-token-saved', true);
      },
      (error) => {
        console.error('[SOCKET EVENT] Failed to save USEAPI_TOKEN:', error.message);
        emitSecretSaveResult('useapi-token-saved', false, error.message);
      }
    );

    listenForCommand(
      'save-tumblr-api-key',
      decodeTumblrApiKeyCommand,
      compatibility?.envSecret({ envKey: 'TUMBLR_API_KEY', runtimeFlag: 'hasTumblrApiKey' }),
      null,
      () => {
        console.log('[SOCKET EVENT] Successfully persisted TUMBLR_API_KEY through the shared admin command path');
        emitSecretSaveResult('tumblr-api-key-saved', true);
      },
      (error) => {
        console.error('[SOCKET EVENT] Failed to save TUMBLR_API_KEY:', error.message);
        emitSecretSaveResult('tumblr-api-key-saved', false, error.message);
      }
    );
  });
};
