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
 * @typedef {object} SessionConfig
 * @property {string} theme
 * @property {'cover' | 'contain'} scaleMode
 * @property {boolean} splitPortrait
 * @property {number} splitCropPercent
 * @property {Record<string, boolean>} widgets
 * @property {number} inactivityTimeout
 * @property {number} slideshowInterval
 * @property {boolean} alignTimeOfDay
 * @property {boolean} alignWeather
 * @property {boolean} allowOpenAiFallback
 * @property {number} nightPercentage
 * @property {Record<string, unknown>} searchKeywords
 * @property {Record<string, unknown>} feedConfigs
 * @property {Record<string, { retentionDays?: number, maxPhotos?: number, schedule?: { enabled?: boolean, start?: string, end?: string, priority?: number }>=} poolPolicies
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
 *   secondaryPercent: number | null,
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

/**
 * @typedef {{
 *   type:
 *     | 'select-categories'
 *     | 'patch-state'
 *     | 'update-excluded-keywords'
 *     | 'set-active-photo'
 *     | 'advance-photo'
 *     | 'rate-photo'
 *     | 'mark-photo-broken'
 *     | 'set-photo-crop'
 *     | 'set-photo-prevent-pairing'
 *     | 'set-photo-loved'
 *     | 'report-photo-metadata'
 *     | 'set-split-portrait'
 *     | 'set-split-crop'
 *     | 'set-scale-mode'
 *     | 'change-theme'
 *     | 'change-interval'
 *     | 'set-screensaver-active'
 *     | 'add-pool'
 *     | 'set-pool-keywords'
 *     | 'merge-pool-feed-config'
 *     | 'set-pool-policy'
 *     | 'delete-pool'
 *     | 'save-env-secret'
 *     | 'trigger-recrawl'
 *     | 'trigger-vision-analysis'
 *   payload?: Record<string, unknown> & { direction?: 'next' | 'prev', strategy?: AdvanceStrategy }
 * }} Command
 */

/**
 * @typedef {{
 *   type: 'state-sync' | 'photo-update'
 * }} Event
 */

/**
 * Closed effect vocabulary emitted by the reducer and interpreted by dispatch.
 * Pool-policy updates emit `refresh-active-feed` with `{ categories: string[] }`;
 * persistence precedes refresh, and events follow successful effect completion.
 * Payloads remain compatibility records here; this declaration does not validate
 * callbacks, make effects atomic, or turn the interpreter into a pure function.
 *
 * @typedef {{
 *   type:
 *     | 'persist'
 *     | 'persist-external-photo-metadata'
 *     | 'refresh-active-feed'
 *     | 'launch-kiosk'
 *     | 'kill-kiosk'
 *     | 'run-crawler'
 *     | 'persist-env-vars'
 *     | 'refresh-weather'
 *     | 'start-recrawl-job'
 *     | 'start-vision-analysis-job'
 *   payload?: Record<string, unknown>
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
