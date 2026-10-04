// @ts-check

const { reduceUntil } = require('./fn.js');

/**
 * @typedef {object} RouteFailure
 * @property {number} status HTTP status used by the route shell.
 * @property {string} error Stable user-facing failure message.
 * @property {Record<string, unknown>} extra Additional route-owned context.
 */

/** @typedef {{routeDecode: true, ok: false, failure: RouteFailure}} RouteDecodeFailure */

/**
 * @template T
 * @typedef {{routeDecode: true, ok: true, value: T}} RouteDecodeSuccess
 */

/**
 * @template T
 * @typedef {RouteDecodeSuccess<T> | RouteDecodeFailure} RouteDecodeResult
 */

/**
 * Build the failure value consumed by the effectful HTTP response boundary.
 *
 * @param {number} status
 * @param {string} error
 * @param {Record<string, unknown>} [extra={}]
 * @returns {RouteFailure}
 */
function createRouteFailure(status, error, extra = {}) {
  return { status, error, extra };
}

/**
 * @template T
 * @param {T} value
 * @returns {RouteDecodeSuccess<T>}
 */
function createRouteDecodeSuccess(value) {
  return { routeDecode: true, ok: true, value };
}

/**
 * @param {number} status
 * @param {string} error
 * @param {Record<string, unknown>} [extra={}]
 * @returns {RouteDecodeFailure}
 */
function createRouteDecodeFailure(status, error, extra = {}) {
  return {
    routeDecode: true,
    ok: false,
    failure: createRouteFailure(status, error, extra)
  };
}

/**
 * Preserve an already-wrapped result; treat every other input as a successful
 * decoded value. This keeps the legacy plain-value decoder contract intact.
 *
 * @template T
 * @param {T | RouteDecodeResult<T>} decoded
 * @returns {RouteDecodeResult<T>}
 */
function normalizeRouteDecodeResult(decoded) {
  const candidate = /** @type {{routeDecode?: unknown} | null | undefined} */ (decoded);
  return candidate?.routeDecode
    ? /** @type {RouteDecodeResult<T>} */ (decoded)
    : createRouteDecodeSuccess(decoded);
}

/**
 * Map a successful decoded value without changing the failure channel.
 *
 * @template T, U
 * @param {(value: T) => U} transform
 * @returns {(decoded: T | RouteDecodeResult<T>) => RouteDecodeResult<U>}
 */
const mapRouteDecode = (transform) => (decoded) => {
  const result = normalizeRouteDecodeResult(decoded);
  return result.ok ? createRouteDecodeSuccess(transform(result.value)) : result;
};

/**
 * Chain a decoder that may fail, preserving the first failure unchanged.
 *
 * @template T, U
 * @param {(value: T) => U | RouteDecodeResult<U>} transform
 * @returns {(decoded: T | RouteDecodeResult<T>) => RouteDecodeResult<U>}
 */
const chainRouteDecode = (transform) => (decoded) => {
  const result = normalizeRouteDecodeResult(decoded);
  return result.ok ? normalizeRouteDecodeResult(transform(result.value)) : result;
};

/**
 * Collect decoder results from left to right, stopping at the first failure.
 * Missing input has the empty-success identity, and bare values remain valid.
 *
 * @template T
 * @param {(T | RouteDecodeResult<T>)[] | null | undefined} [results=[]]
 * @returns {RouteDecodeResult<T[]>}
 */
const collectRouteDecodeResults = (results = []) => reduceUntil(
  (collected, result) => {
    const normalized = normalizeRouteDecodeResult(result);
    return normalized.ok
      ? createRouteDecodeSuccess([...collected.value, normalized.value])
      : normalized;
  },
  ({ ok }) => !ok,
  createRouteDecodeSuccess([])
)(results);

module.exports = {
  chainRouteDecode,
  collectRouteDecodeResults,
  createRouteDecodeFailure,
  createRouteDecodeSuccess,
  createRouteFailure,
  mapRouteDecode,
  normalizeRouteDecodeResult
};
