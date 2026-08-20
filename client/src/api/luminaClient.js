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
    const error = new Error(errorMessage);
    error.status = response.status;
    error.path = path;
    throw error;
  }

  return payload;
}

export function getStateSnapshot() {
  return requestJson('/api/state');
}

export function patchState(body) {
  return requestJson('/api/state', {
    method: 'PATCH',
    body
  });
}

const withLegacySocketFallback = ({ socket, event, payload }) => async (request) => {
  try {
    return await request();
  } catch (error) {
    // Mixed-version deploys can briefly pair a REST-first client with a daemon
    // that still only understands the legacy socket mutation.
    if (error?.status === 404 && socket?.emit) {
      socket.emit(event, payload);
      return null;
    }
    throw error;
  }
};

export function selectCategories(categories, { socket } = {}) {
  return withLegacySocketFallback({
    socket,
    event: 'change-category',
    payload: categories
  })(() => requestJson('/api/state/categories', {
    method: 'POST',
    body: { categories }
  }));
}

export function setScreensaverActive(active, { socket } = {}) {
  return withLegacySocketFallback({
    socket,
    event: 'set-screensaver-active',
    payload: active
  })(() => requestJson('/api/state/screensaver', {
    method: 'POST',
    body: { active }
  }));
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

export function createPool({ name, keywords }) {
  return requestJson('/api/pools', {
    method: 'POST',
    body: { name, keywords }
  });
}

export function deletePool(name) {
  return requestJson(`/api/pools/${encodeURIComponent(name)}`, {
    method: 'DELETE'
  });
}

export function patchPool(name, body) {
  return requestJson(`/api/pools/${encodeURIComponent(name)}`, {
    method: 'PATCH',
    body
  });
}

export function patchPoolFeedSource(name, source, config) {
  return requestJson(`/api/pools/${encodeURIComponent(name)}/feed-sources/${encodeURIComponent(source)}`, {
    method: 'PATCH',
    body: config
  });
}

function postAdminSecret(path, body, legacyEvent, { socket } = {}) {
  return withLegacySocketFallback({
    socket,
    event: legacyEvent,
    payload: body
  })(() => requestJson(path, {
    method: 'POST',
    body
  }));
}

export function startRecrawlJob(body = {}, { socket } = {}) {
  return withLegacySocketFallback({
    socket,
    event: 'trigger-recrawl',
    payload: body
  })(() => requestJson('/api/jobs/recrawl', {
    method: 'POST',
    body
  }));
}

export function saveUseApiToken(token, { socket } = {}) {
  return postAdminSecret('/api/admin/secrets/useapi-token', { token }, 'save-useapi-token', { socket });
}

export function saveTumblrApiKey(token, { socket } = {}) {
  return postAdminSecret('/api/admin/secrets/tumblr-api-key', { token }, 'save-tumblr-api-key', { socket });
}

export function startVisionAnalysisJob(body = {}, { socket } = {}) {
  return withLegacySocketFallback({
    socket,
    event: 'trigger-vision-analysis',
    payload: body
  })(() => requestJson('/api/jobs/vision-analysis', {
    method: 'POST',
    body
  }));
}
