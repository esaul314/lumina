// @ts-check

/**
 * @typedef {'portrait' | 'landscape' | 'unknown'} PhotoOrientation
 */

/**
 * @typedef {'sequence' | 'smart'} AdvanceStrategy
 */

/**
 * @typedef {{ start: string, end: string }} TimeRange
 */

/**
 * Normalized selector-facing photo shape; not a guarantee about a preview
 * accepted by the active-photo decoder or arbitrary compatibility state.
 * @typedef {object} Photo
 * @property {string} url
 * @property {string=} title
 * @property {string=} author
 * @property {string=} source
 * @property {string=} category
 * @property {string=} addedAt ISO timestamp for when Lumina first accepted the photo into a pool
 * @property {number=} rating
 * @property {boolean=} isBroken
 * @property {boolean=} preventPairing
 * @property {boolean=} loved
 * @property {number=} cropPercent
 * @property {number=} cropPositionY
 * @property {PhotoOrientation=} orientation
 * @property {number=} width
 * @property {number=} height
 * @property {boolean=} isNight
 * @property {boolean=} isRain
 * @property {boolean=} isSunny
 * @property {boolean=} isCloudy
 * @property {boolean=} isSnowy
 * @property {TimeRange[]=} timeRanges
 */

/**
 * @typedef {Record<string, Photo[]>} CollectionsState
 */

/**
 * @typedef {object} PoolConfig
 * @property {Record<string, { enabled?: boolean, keywords?: string[], subreddits?: string[], blogs?: string[] }>=} unsplash
 */

/**
 * Compatibility state, not a fully normalized configuration. Theme, scale mode,
 * timing values, split portrait, split crop, weather alignment, and the OpenAI fallback flag can
 * pass through patches and snapshots without validation or copying.
 * @typedef {object} SessionConfig
 * @property {unknown} theme
 * @property {unknown} scaleMode
 * @property {unknown} splitPortrait
 * @property {unknown} splitCropPercent
 * @property {Record<string, boolean>} widgets
 * @property {unknown} inactivityTimeout
 * @property {unknown} slideshowInterval
 * @property {unknown} alignTimeOfDay
 * @property {unknown} alignWeather
 * @property {unknown} allowOpenAiFallback
 * @property {unknown} nightPercentage Raw compatibility patches are not validated.
 * @property {Record<string, unknown>} searchKeywords
 * @property {Record<string, unknown>} feedConfigs
 * @property {Record<string, { retentionDays?: number, maxPhotos?: number, schedule?: { enabled?: boolean, start?: string, end?: string, priority?: number } }>=} poolPolicies
 * @property {string[]} excludedKeywords
 * @property {boolean} autoLocation
 * @property {Record<string, unknown>} manualLocation
 * @property {Record<string, unknown>=} visionConfig
 */

/**
 * @typedef {object} RuntimeState
 * @property {boolean} screensaverActive
 * @property {boolean} hasUseApiToken
 * @property {boolean=} hasTumblrApiKey
 * @property {boolean=} browserRunning
 * @property {boolean=} manualOverride
 * @property {Record<string, unknown>} newsSentiment
 * @property {Record<string, unknown>} physicalWeather
 * @property {{ location?: Record<string, unknown>, current?: Record<string, unknown>, daily?: Record<string, unknown> } | null} weather
 */

/**
 * @typedef {object} PlaybackState
 * @property {string[]} selectedCategories
 * @property {string | null} activePhotoUrl
 * @property {number} splitSeed
 * @property {'next' | 'prev'} lastDirection
 * @property {Record<string, number>} poolSequenceCursors
 */

/**
 * @typedef {object} CurrentFrame
 * @property {Photo | null} primary
 * @property {Photo | null} secondary
 * @property {'single' | 'split'} layout
 * @property {{
 *   primaryPercent: number | null,
 *   primaryPositionY: number | null,
 *   secondaryPercent: unknown,
 *   secondaryPositionY: number | null
 * }} crop
 * @property {{
 *   category: string | null,
 *   categories: string[],
 *   photoCount: number,
 *   orientation: PhotoOrientation,
 *   splitEligible: boolean
 * }} context
 */

/**
 * @typedef {object} DomainState
 * @property {SessionConfig} config
 * @property {RuntimeState} runtime
 * @property {{ collections: CollectionsState, externalCollections?: CollectionsState, photosList: Photo[] }} library
 * @property {PlaybackState} playback
 */

/** @typedef {import('../utils/keywordSpecs').KeywordSpec} KeywordSpec */
/** @typedef {import('./poolRetention').PoolPolicyInput} PoolPolicyInput */

/**
 * Original object passed through by the active-photo decoder, including arrays
 * and inherited/accessor properties. Only the separate command URL is checked;
 * metadata and even later reads of the object's URL are not validated. The
 * reducer may shallow-copy this object into its feed without normalization.
 * @typedef {object} ActivePhotoPreview
 */

/**
 * Decoder output, not validated SessionConfig. Scalar patch values are passed
 * through and interpreted by the reducer; widgets/exclusions retain raw entries.
 * Location/vision records are normalized by their dedicated projections.
 *
 * @typedef {{
 *   theme?: unknown, inactivityTimeout?: unknown, slideshowInterval?: unknown,
 *   scaleMode?: unknown, splitPortrait?: unknown, splitCropPercent?: unknown,
 *   alignTimeOfDay?: unknown, alignWeather?: unknown, nightPercentage?: unknown,
 *   allowOpenAiFallback?: unknown, excludedKeywords?: unknown[],
 *   widgets?: Record<string, unknown>, autoLocation?: boolean,
 *   manualLocation?: {lat: number, lon: number, city: string, regionName: string, country: string},
 *   visionConfig?: Record<'apiUrl' | 'apiKey' | 'model' | 'fallbackUrl' | 'fallbackApiKey' | 'fallbackModel', string>
 * }} StatePatchPayload
 */

/**
 * Discriminated command family. Required fields apply when a payload is present;
 * omission remains allowed for legacy direct reducer callers. Decoders normally
 * emit payload objects (including {} for unscoped jobs), or null on rejection.
 * These shapes do not validate arbitrary direct calls or change their coercions.
 * Numeric fields are numbers, not a promise of finite/in-range dimensions.
 * Category selection accepts a comma-separated string or a direct string array.
 *
 * @typedef {{
 *   'select-categories': {categories: string | string[]},
 *   'patch-state': StatePatchPayload,
 *   'update-excluded-keywords': {keywords: unknown[]},
 *   'set-active-photo': {url: string, photo?: ActivePhotoPreview},
 *   'advance-photo': {direction?: 'next' | 'prev', strategy?: AdvanceStrategy},
 *   'rate-photo': {url: string, rating: number},
 *   'mark-photo-broken': {url: string},
 *   'set-photo-crop': {url: string, cropPercent?: number, cropPositionY?: number},
 *   'set-photo-prevent-pairing': {url: string, preventPairing: boolean, preserveActive?: boolean},
 *   'set-photo-loved': {url: string, loved: boolean},
 *   'report-photo-metadata': {url: string, orientation: 'portrait' | 'landscape', width?: number, height?: number},
 *   'set-split-portrait': {enabled: boolean},
 *   'set-split-crop': {percent: number},
 *   'set-scale-mode': {mode: 'cover' | 'contain'},
 *   'change-theme': {theme: string},
 *   'change-interval': {intervalMs: number},
 *   'set-screensaver-active': {active: boolean},
 *   'add-pool': {name: string, keywords: string[]},
 *   'set-pool-keywords': {name: string, keywords: KeywordSpec[]},
 *   'merge-pool-feed-config': {name: string, source: string, config: Record<string, unknown>},
 *   'set-pool-policy': {name: string, policy: PoolPolicyInput},
 *   'delete-pool': {name: string},
 *   'save-env-secret': {envKey: string, runtimeFlag: string, value: string},
 *   'trigger-recrawl': {categories?: string[]},
 *   'trigger-vision-analysis': {categories?: string[]}
 * }} CommandPayloads
 */

/** @typedef {{[K in keyof CommandPayloads]: {type: K, payload?: CommandPayloads[K]}}[keyof CommandPayloads]} Command */
/** @typedef {(input: unknown) => Command | null} CommandDecoder */

/**
 * @typedef {{
 *   type: 'state-sync' | 'photo-update'
 * }} Event
 */

/**
 * Closed effect vocabulary emitted by the reducer and interpreted by dispatch.
 * Reducer metadata omits undefined fields. Direct malformed calls remain outside
 * this normalized description; neither numeric validation nor atomicity is added.
 *
 * @typedef {Partial<Pick<Photo, 'rating' | 'isBroken' | 'cropPercent' | 'cropPositionY' | 'preventPairing' | 'loved' | 'orientation' | 'width' | 'height'>>} PhotoMetadataPatch
 */

/** @typedef {{url: string, metadata: PhotoMetadataPatch}} ExternalPhotoMetadataPayload */
/** @typedef {{categories: string[]}} CategoryEffectPayload */
/** @typedef {{entries: Record<string, string>, runtimeFlags: Record<string, boolean>}} EnvVarsEffectPayload */

/**
 * Closed reducer-emitted effect family. Payload-free effects omit the field;
 * category jobs always carry a fresh array (empty means unscoped). Curated
 * persistence precedes external metadata/feed refresh; events follow completion.
 * Interpreter compatibility with missing/malformed payloads is not validation.
 * Effects describe ordered work, not pure computations or atomic transactions.
 *
 * @typedef {{
 *   type: 'persist' | 'launch-kiosk' | 'kill-kiosk' | 'refresh-weather'
 * } | {
 *   type: 'persist-external-photo-metadata', payload: ExternalPhotoMetadataPayload
 * } | {
 *   type: 'refresh-active-feed' | 'run-crawler' | 'start-recrawl-job' | 'start-vision-analysis-job',
 *   payload: CategoryEffectPayload
 * } | {
 *   type: 'persist-env-vars', payload: EnvVarsEffectPayload
 * }} Effect
 */

/**
 * Execution inputs, not sensor settings. With a stable date and replayable RNG,
 * reduction is deterministic; omitted/falsy fields retain the ambient defaults.
 * Truthy inputs are used verbatim, without validation or RNG range clamping.
 * `now` is a Date value, not a clock callback; `rng` conventionally returns [0, 1).
 *
 * @typedef {object} ReducerEnvironment
 * @property {Date | null} [now] Defaults to a fresh Date on each reduction.
 * @property {(() => number) | null} [rng] Defaults to Math.random, called only as needed.
 */

/**
 * Ordered descriptions, not executed effects. A no-op retains the input state
 * identity with fresh empty event/effect arrays; changed states are projections.
 * This envelope is neither an atomic transaction nor a result-combining Monoid.
 *
 * @typedef {{
 *   nextState: DomainState,
 *   events: Event[],
 *   effects: Effect[]
 * }} ReducerResult
 */

module.exports = {};
