// @ts-check

/**
 * @typedef {Error & { status?: number, path?: string }} ApiError
 */

/**
 * Keep response interpretation deterministic and separate from transport.
 *
 * @param {string | null | undefined} contentType
 * @returns {boolean}
 */
export const isJsonContentType = (contentType) => {
  if (typeof contentType !== 'string') return false;
  const mediaType = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return mediaType === 'application/json' || mediaType.endsWith('+json');
};

/**
 * @param {number} status
 * @returns {Error}
 */
export const createJsonUnavailableError = (status) => (
  new Error(`JSON API unavailable (${status})`)
);

/**
 * @param {unknown} payload
 * @param {number} status
 * @param {string} path
 * @returns {ApiError}
 */
const createRequestError = (payload, status, path) => {
  const record = payload && typeof payload === 'object'
    ? /** @type {Record<string, unknown>} */ (payload)
    : {};
  const message = typeof record.error === 'string'
    ? record.error
    : (typeof record.message === 'string' ? record.message : `Request failed: ${status}`);
  const error = /** @type {ApiError} */ (new Error(message));
  error.status = status;
  error.path = path;
  return error;
};

/**
 * @returns {string}
 */
export const getApiBaseUrl = () => (
  window.location.port === '5173'
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : window.location.origin
);

/**
 * Interpret one JSON REST request. Fetch and response parsing are deliberately
 * kept here as the imperative edge; callers receive a stable JSON contract.
 *
 * @template Response
 * @param {string} path
 * @param {{ method?: string, body?: unknown, requireJson?: boolean }} [options]
 * @returns {Promise<Response>}
 */
export async function requestJson(path, {
  method = 'GET',
  body,
  requireJson = false
} = {}) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (requireJson && response.headers?.get && !isJsonContentType(response.headers.get('content-type'))) {
    throw createJsonUnavailableError(response.status);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw createRequestError(payload, response.status, path);
  return /** @type {Response} */ (payload);
}

/**
 * @template Response
 * @param {string} path
 * @returns {Promise<Response>}
 */
export const readJson = (path) => requestJson(path, { requireJson: true });

/**
 * @template Response
 * @param {string} path
 * @param {unknown} body
 * @returns {Promise<Response>}
 */
export const postJson = (path, body) => requestJson(path, {
  method: 'POST',
  body
});
