// @ts-check

import { buildMutationPlan } from './requestPlans.js';

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

const runMutationPlan = (buildPlan, input, { socket } = {}) => {
  const plan = buildPlan(input);

  return withLegacySocketFallback({
    socket,
    event: plan.legacy.event,
    payload: plan.legacy.payload
  })(() => requestJson(plan.path, {
    method: plan.method,
    body: plan.body
  }));
};

const selectCategoriesMutation = buildMutationPlan({
  path: '/api/state/categories',
  event: 'change-category',
  body: (categories) => ({ categories })
});

const screensaverMutation = buildMutationPlan({
  path: '/api/state/screensaver',
  event: 'set-screensaver-active',
  body: (active) => ({ active })
});

const recrawlMutation = buildMutationPlan({
  path: '/api/jobs/recrawl',
  event: 'trigger-recrawl'
});

const visionAnalysisMutation = buildMutationPlan({
  path: '/api/jobs/vision-analysis',
  event: 'trigger-vision-analysis'
});

const useApiTokenMutation = buildMutationPlan({
  path: '/api/admin/secrets/useapi-token',
  event: 'save-useapi-token',
  body: (token) => ({ token }),
  legacy: (token) => ({ token })
});

const tumblrApiKeyMutation = buildMutationPlan({
  path: '/api/admin/secrets/tumblr-api-key',
  event: 'save-tumblr-api-key',
  body: (token) => ({ token }),
  legacy: (token) => ({ token })
});

export function selectCategories(categories, { socket } = {}) {
  return runMutationPlan(selectCategoriesMutation, categories, { socket });
}

export function setScreensaverActive(active, { socket } = {}) {
  return runMutationPlan(screensaverMutation, active, { socket });
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

export function startRecrawlJob(body = {}, { socket } = {}) {
  return runMutationPlan(recrawlMutation, body, { socket });
}

export function saveUseApiToken(token, { socket } = {}) {
  return runMutationPlan(useApiTokenMutation, token, { socket });
}

export function saveTumblrApiKey(token, { socket } = {}) {
  return runMutationPlan(tumblrApiKeyMutation, token, { socket });
}

export function startVisionAnalysisJob(body = {}, { socket } = {}) {
  return runMutationPlan(visionAnalysisMutation, body, { socket });
}
