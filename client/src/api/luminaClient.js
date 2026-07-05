// @ts-check

/**
 * @typedef {{
 *   success?: boolean,
 *   photo?: Record<string, unknown>,
 *   activePhoto?: Record<string, unknown>,
 *   screensaverActive?: boolean
 * }} LuminaApiResponse
 */

function getApiBaseUrl() {
  return window.location.port === '5173'
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : window.location.origin;
}

async function requestJson(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  /** @type {LuminaApiResponse | { error?: string, message?: string }} */
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = typeof payload?.error === 'string'
      ? payload.error
      : (typeof payload?.message === 'string' ? payload.message : `Request failed: ${response.status}`);
    throw new Error(errorMessage);
  }

  return payload;
}

export function getStateSnapshot() {
  return requestJson('/api/state');
}

export function patchPhoto(body) {
  return requestJson('/api/photos', {
    method: 'PATCH',
    body
  });
}

export function previewPhoto(photo) {
  return requestJson('/api/photos/preview', {
    method: 'POST',
    body: photo
  });
}

export function nextPhoto() {
  return requestJson('/api/photos/next', {
    method: 'POST'
  });
}

export function prevPhoto() {
  return requestJson('/api/photos/prev', {
    method: 'POST'
  });
}
