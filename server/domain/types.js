// @ts-check

/**
 * @typedef {'portrait' | 'landscape' | 'unknown'} PhotoOrientation
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
 * @property {number=} rating
 * @property {boolean=} isBroken
 * @property {boolean=} preventPairing
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
 *     | 'update-excluded-keywords'
 *     | 'set-active-photo'
 *     | 'advance-photo'
 *     | 'rate-photo'
 *     | 'mark-photo-broken'
 *     | 'set-photo-crop'
 *     | 'set-photo-prevent-pairing'
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
 *     | 'delete-pool'
 *   payload?: Record<string, unknown>
 * }} Command
 */

/**
 * @typedef {{
 *   type: 'state-sync' | 'photo-update'
 * }} Event
 */

/**
 * @typedef {{
 *   type:
 *     | 'persist'
 *     | 'launch-kiosk'
 *     | 'kill-kiosk'
 *     | 'run-crawler'
 *   payload?: Record<string, unknown>
 * }} Effect
 */

/**
 * @typedef {{
 *   nextState: DomainState,
 *   events: Event[],
 *   effects: Effect[]
 * }} ReducerResult
 */

module.exports = {};
