// @ts-check

/**
 * A short, deterministic retry schedule keeps transient media outages from
 * turning one failed request into a rapid sequence of photo changes.
 */
export const MEDIA_RETRY_DELAYS_MS = Object.freeze([1000, 2000, 4000, 8000]);

/**
 * @typedef {'retry'|'hold'|'skip'} MediaRecoveryAction
 * @typedef {{ action: MediaRecoveryAction, attempt: number, delayMs?: number }} MediaRecoveryDecision
 */

/**
 * Decide what the effect shell should do after one image-load failure.
 *
 * The decision is pure: browser connectivity probes and timers stay outside
 * this module, while a reachable host is the only condition that permits a
 * failed URL to be classified as broken.
 *
 * @param {{ attempt?: number, hostReachable: boolean }} input
 * @returns {MediaRecoveryDecision}
 */
export const decideMediaFailure = ({ attempt = 0, hostReachable }) => {
  const normalizedAttempt = Number.isInteger(attempt) && attempt >= 0 ? attempt : 0;
  const delayMs = MEDIA_RETRY_DELAYS_MS[normalizedAttempt];

  if (delayMs !== undefined) {
    return {
      action: 'retry',
      attempt: normalizedAttempt + 1,
      delayMs
    };
  }

  return {
    action: hostReachable ? 'skip' : 'hold',
    attempt: normalizedAttempt
  };
};

/**
 * Build a lightweight same-origin probe URL for an image host. A request to
 * the host root tests DNS/connectivity without downloading the image again.
 *
 * @param {string} imageUrl
 * @param {string} baseUrl
 * @returns {string|null}
 */
export const buildMediaOriginProbeUrl = (imageUrl, baseUrl) => {
  try {
    return new URL(imageUrl, baseUrl).origin;
  } catch (_error) {
    return null;
  }
};
