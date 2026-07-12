// @ts-check

const { sendEmailAlert } = require('./services/notifier.js');
const googlePhotos = require('./services/googlePhotos.js');
const { getHostDisplayInfo } = require('./services/system.js');
const { createSocketLegacyCompatibility } = require('./socketLegacyCompatibility.js');
const {
  SOCKET_STATE_PATCH_SPECS,
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

const decodeScreensaverActiveFromSocket = (active) => decodeScreensaverActiveCommand({ active });
const buildSocketErrorLogger = (label) => (error) => {
  console.error(`Socket Event: ${label} failed:`, error.message);
};
const emitSocketEvent = (socket, event) => (payload) => {
  socket.emit(event, payload);
};
const createLoggedDecoder = (buildMessage, decode) => (payload) => {
  console.log(typeof buildMessage === 'function' ? buildMessage(payload) : buildMessage);
  return decode(payload);
};
const registerCommandSpecs = (listenForCommand) => (specs) => specs.forEach(({
  event,
  decode,
  fallback,
  intercept,
  afterDispatch,
  onError
}) => {
  listenForCommand(event, decode, fallback, intercept, afterDispatch, onError);
});
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
    const emitRecrawlUnavailable = emitSocketEvent(socket, 'recrawl-complete');
    const emitVisionAnalysisUnavailable = emitSocketEvent(socket, 'job-status');

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
    const registerCommands = registerCommandSpecs(listenForCommand);

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

    const emitSecretSaveResult = (eventName, success, error) => {
      socket.emit(eventName, success ? { success: true } : { success: false, error });
    };

    const createSecretSaveSpec = ({
      event,
      decode,
      envKey,
      runtimeFlag,
      successEvent
    }) => ({
      event,
      decode,
      fallback: compatibility?.envSecret({ envKey, runtimeFlag }),
      afterDispatch: () => {
        console.log(`[SOCKET EVENT] Successfully persisted ${envKey} through the shared admin command path`);
        emitSecretSaveResult(successEvent, true);
      },
      onError: (error) => {
        console.error(`[SOCKET EVENT] Failed to save ${envKey}:`, error.message);
        emitSecretSaveResult(successEvent, false, error.message);
      }
    });

    SOCKET_STATE_PATCH_SPECS.forEach(({ event, decode }) => {
      listenForStatePatch(event, decode);
    });

    registerCommands([
      {
        event: 'change-category',
        decode: createLoggedDecoder(
          (category) => `[SOCKET EVENT] change-category received: "${category}"`,
          decodeCategorySelectionFromSocket
        ),
        fallback: compatibility?.categorySelection
      },
      { event: 'set-active-photo', decode: decodeActivePhotoCommand, fallback: compatibility?.activePhoto },
      { event: 'report-photo-metadata', decode: decodePhotoMetadataCommand, fallback: compatibility?.photoMetadata },
      { event: 'rate-photo', decode: decodePhotoRatingCommand, fallback: compatibility?.photoRating },
      { event: 'set-photo-crop', decode: decodePhotoCropCommand, fallback: compatibility?.photoCrop },
      {
        event: 'set-photo-prevent-pairing',
        decode: decodePhotoPreventPairingCommand,
        fallback: compatibility?.photoPreventPairing
      },
      { event: 'update-keywords', decode: decodePoolKeywordsCommand, fallback: compatibility?.poolKeywords },
      { event: 'update-feed-config', decode: decodePoolFeedConfigCommand, fallback: compatibility?.poolFeedConfig },
      {
        event: 'update-excluded-keywords',
        decode: decodeExcludedKeywordsCommand,
        fallback: compatibility?.excludedKeywords
      },
      { event: 'add-category', decode: decodeAddPoolCommand, fallback: compatibility?.addPool },
      { event: 'delete-category', decode: decodeDeletePoolCommand, fallback: compatibility?.deletePool },
      {
        event: 'next-photo',
        decode: () => decodeAdvancePhotoCommand('next'),
        fallback: compatibility?.advancePhoto('next')
      },
      {
        event: 'prev-photo',
        decode: () => decodeAdvancePhotoCommand('prev'),
        fallback: compatibility?.advancePhoto('prev')
      },
      {
        event: 'set-screensaver-active',
        decode: decodeScreensaverActiveFromSocket,
        fallback: compatibility?.screensaverActive
      },
      {
        event: 'mark-photo-broken',
        decode: createLoggedDecoder(
          (payload) => `[SOCKET EVENT] mark-photo-broken received for URL: ${payload?.url}`,
          decodeBrokenPhotoCommand
        ),
        fallback: compatibility?.brokenPhoto
      },
      {
        event: 'trigger-recrawl',
        decode: createLoggedDecoder(
          '[SOCKET EVENT] trigger-recrawl received. Initiating manual crawl...',
          decodeRecrawlCommand
        ),
        fallback: () => {
          emitRecrawlUnavailable({ success: false, error: 'Recrawl dispatcher unavailable.' });
        }
      },
      {
        event: 'trigger-vision-analysis',
        decode: createLoggedDecoder(
          '[SOCKET EVENT] trigger-vision-analysis received. Initiating manual vision analysis...',
          decodeVisionAnalysisCommand
        ),
        fallback: () => {
          emitVisionAnalysisUnavailable({
            type: 'vision-analysis',
            status: 'failed',
            error: 'Vision-analysis dispatcher unavailable.'
          });
        }
      },
      createSecretSaveSpec({
        event: 'save-useapi-token',
        decode: decodeUseApiTokenCommand,
        envKey: 'USEAPI_TOKEN',
        runtimeFlag: 'hasUseApiToken',
        successEvent: 'useapi-token-saved'
      }),
      createSecretSaveSpec({
        event: 'save-tumblr-api-key',
        decode: decodeTumblrApiKeyCommand,
        envKey: 'TUMBLR_API_KEY',
        runtimeFlag: 'hasTumblrApiKey',
        successEvent: 'tumblr-api-key-saved'
      })
    ]);
  });
};
