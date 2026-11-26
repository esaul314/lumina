const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { compileFunction } = require('node:vm');
const { createRequire } = require('node:module');

const routesPath = path.join(__dirname, 'routes.js');
const callbackPath = '/api/auth/google/callback';
const stateCookieName = 'lumina_google_oauth_state';
const trustedRedirectUri = `https://photos.example.test${callbackPath}`;

function loadRoutes(googlePhotos) {
  const module = { exports: {} };
  const nativeRequire = createRequire(routesPath);
  compileFunction(fs.readFileSync(routesPath, 'utf8'), ['module', 'require'], { filename: routesPath })(
    module,
    name => name === './services/googlePhotos.js'
      ? googlePhotos
      : name === './services/weather.js' ? {} : nativeRequire(name)
  );
  return module.exports;
}

async function withAuthServer(run, {
  configuredRedirectUri = trustedRedirectUri,
  providerConfigured = true,
  now = () => Date.now()
} = {}) {
  const calls = { auth: [], exchanges: [], picker: 0, sandboxSyncs: 0 };
  const googlePhotos = {
    getCachedMediaItems: () => [],
    getGoogleAuthUrl(redirectUri, state) {
      calls.auth.push({ redirectUri, state });
      return providerConfigured
        ? `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ redirect_uri: redirectUri, state })}`
        : `/api/auth/google/sandbox-callback?redirect_uri=${encodeURIComponent(redirectUri)}`;
    },
    async exchangeGoogleCode(code, redirectUri) { calls.exchanges.push({ code, redirectUri }); },
    async createPickerSession() {
      calls.picker += 1;
      return { id: 'picker-session', pickerUri: 'https://photos.google.com/picker/session' };
    },
    async syncGoogleAlbum() { calls.sandboxSyncs += 1; },
    async getPickerSession() { return { mediaItemsSet: false }; },
    async deletePickerSession() {}
  };
  const state = {
    currentCategory: 'Scenic Nature', photosList: [], activePhoto: null, widgets: {},
    searchKeywords: {}, feedConfigs: {}, poolPolicies: {}, excludedKeywords: [], manualLocation: {}
  };
  const app = require('express')();
  loadRoutes(googlePhotos)({
    app,
    state,
    collections: {},
    getWeatherData: () => null,
    setWeatherData() {},
    io: { emit() {} },
    port: 0,
    googleRedirectUri: configuredRedirectUri,
    now
  });
  const server = http.createServer(app);
  const intervalHandles = new Set();
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  global.setInterval = callback => {
    const handle = { callback };
    intervalHandles.add(handle);
    return handle;
  };
  global.clearInterval = handle => intervalHandles.delete(handle);

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    const request = (requestPath, headers = {}) => new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1', port: address.port, path: requestPath,
        method: 'GET', headers
      }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve({
          status: response.statusCode,
          headers: response.headers,
          body: Buffer.concat(chunks).toString('utf8')
        }));
      });
      req.once('error', reject);
      req.end();
    });
    await run({ request, calls, intervalHandles });
  } finally {
    intervalHandles.forEach(handle => global.clearInterval(handle));
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

const login = async request => {
  const response = await request('/api/auth/google/login', {
    Host: 'attacker.invalid', 'X-Forwarded-Host': 'forwarded-attacker.invalid',
    'X-Forwarded-Proto': 'http'
  });
  return { response, authUrl: new URL(response.headers.location, 'http://lumina.test'), cookie: response.headers['set-cookie']?.[0] || '' };
};
const getState = authUrl => authUrl.searchParams.get('state');
const getCookieValue = cookie => cookie.match(new RegExp(`^${stateCookieName}=([a-f0-9]+)`))?.[1] || '';
const cookieClear = response => response.headers['set-cookie']?.[0] || '';

test('Google login binds one-time state to the browser and uses the configured callback, never Host headers', () => withAuthServer(async f => {
  const { response, authUrl, cookie } = await login(f.request);
  const state = getState(authUrl);
  assert.equal(response.status, 302);
  assert.equal(authUrl.origin, 'https://accounts.google.com');
  assert.equal(authUrl.searchParams.get('redirect_uri'), trustedRedirectUri);
  assert.match(state || '', /^[a-f0-9]{64}$/);
  assert.equal(getCookieValue(cookie), state);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Max-Age=600/);
  assert.deepEqual(f.calls.auth, [{ redirectUri: trustedRedirectUri, state }]);

  const callback = await f.request(`${callbackPath}?${new URLSearchParams({ code: 'one-use-code', state })}`, {
    Host: 'another-attacker.invalid', Cookie: `${stateCookieName}=${state}`
  });
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.location, 'https://photos.google.com/picker/session/autoclose');
  assert.match(cookieClear(callback), /Max-Age=0/);
  assert.deepEqual(f.calls.exchanges, [{ code: 'one-use-code', redirectUri: trustedRedirectUri }]);
  assert.equal(f.calls.picker, 1);

  const replay = await f.request(`${callbackPath}?${new URLSearchParams({ code: 'replay-code', state })}`, {
    Cookie: `${stateCookieName}=${state}`
  });
  assert.equal(replay.status, 400);
  assert.match(replay.body, /already used/);
  assert.equal(f.calls.exchanges.length, 1);
  assert.equal(f.calls.picker, 1);
}));

test('missing, mismatched, malformed and expired state never reaches token exchange', () => withAuthServer(async f => {
  const { authUrl } = await login(f.request);
  const state = getState(authUrl);
  const cookie = `${stateCookieName}=${state}`;
  const cases = [
    { suffix: '', headers: { Cookie: cookie } },
    { suffix: `?${new URLSearchParams({ code: 'x', state: 'a'.repeat(64) })}`, headers: { Cookie: cookie } },
    { suffix: `?${new URLSearchParams({ code: 'x', state: 'not-a-token' })}`, headers: { Cookie: cookie } },
    { suffix: `?${new URLSearchParams({ code: 'x', state })}`, headers: {} }
  ];
  for (const { suffix, headers } of cases) {
    const response = await f.request(`${callbackPath}${suffix}`, headers);
    assert.equal(response.status, 400);
    assert.match(cookieClear(response), /Max-Age=0/);
  }
  assert.deepEqual(f.calls.exchanges, []);
  assert.equal(f.calls.picker, 0);
}));

test('expired pending state is rejected even if an old cookie is manually replayed', () => {
  let clock = 1_800_000_000_000;
  return withAuthServer(async f => {
    const { authUrl } = await login(f.request);
    const state = getState(authUrl);
    clock += 600_001;
    const response = await f.request(`${callbackPath}?${new URLSearchParams({ code: 'expired-code', state })}`, {
      Cookie: `${stateCookieName}=${state}`
    });
    assert.equal(response.status, 400);
    assert.match(response.body, /expired/);
    assert.deepEqual(f.calls.exchanges, []);
  }, { now: () => clock });
});

test('invalid trusted redirect configuration fails closed before creating a provider redirect', async () => {
  const invalidRedirectUris = [
    '',
    '/api/auth/google/callback',
    'ftp://photos.example.test/api/auth/google/callback',
    'http://photos.example.test/api/auth/google/callback',
    'https://photos.example.test/elsewhere',
    'https://user@photos.example.test/api/auth/google/callback',
    `${trustedRedirectUri}?next=/`,
    `${trustedRedirectUri}#callback`
  ];
  for (const configuredRedirectUri of invalidRedirectUris) {
    await withAuthServer(async f => {
      const response = await f.request('/api/auth/google/login', { Host: 'attacker.invalid' });
      assert.equal(response.status, 503);
      assert.match(response.body, /callback URI is not configured/);
      assert.equal(response.headers.location, undefined);
      assert.equal(response.headers['set-cookie'], undefined);
      assert.equal(f.calls.exchanges.length, 0);
    }, { configuredRedirectUri });
  }
});

test('loopback HTTP callback URLs remain available for local development without weakening remote callbacks', async () => {
  for (const configuredRedirectUri of [
    'http://localhost:5000/api/auth/google/callback',
    'http://127.0.0.1:5000/api/auth/google/callback',
    'http://[::1]:5000/api/auth/google/callback'
  ]) {
    await withAuthServer(async f => {
      const { response, authUrl, cookie } = await login(f.request);
      assert.equal(response.status, 302);
      assert.equal(authUrl.searchParams.get('redirect_uri'), configuredRedirectUri);
      assert.equal(getCookieValue(cookie), getState(authUrl));
      assert.doesNotMatch(cookie, /Secure/);
    }, { configuredRedirectUri });
  }
});

test('sandbox callback remains local and ignores untrusted Host redirect input', () => withAuthServer(async f => {
  const { response, authUrl, cookie } = await login(f.request);
  assert.equal(response.status, 302);
  assert.equal(authUrl.pathname, '/api/auth/google/sandbox-callback');
  assert.equal(authUrl.searchParams.has('state'), false);
  assert.equal(cookie, '');

  const sandbox = await f.request(`${authUrl.pathname}${authUrl.search}`, { Host: 'attacker.invalid' });
  assert.equal(sandbox.status, 302);
  assert.equal(sandbox.headers.location, '/?mode=remote&googleAuth=success');
  assert.deepEqual(f.calls.exchanges, [{ code: 'sandbox-code', redirectUri: '' }]);
  assert.equal(f.calls.sandboxSyncs, 1);
}, { configuredRedirectUri: '', providerConfigured: false }));

test('provider denial consumes a valid challenge without exchanging a code or starting a Picker session', () => withAuthServer(async f => {
  const { authUrl } = await login(f.request);
  const state = getState(authUrl);
  const denied = await f.request(`${callbackPath}?${new URLSearchParams({ error: 'access_denied', state })}`, {
    Cookie: `${stateCookieName}=${state}`
  });
  assert.equal(denied.status, 400);
  assert.match(denied.body, /authorization was not completed/);
  assert.deepEqual(f.calls.exchanges, []);
  assert.equal(f.calls.picker, 0);

  const pending = await login(f.request);
  const pendingState = getState(pending.authUrl);
  const missingCode = await f.request(`${callbackPath}?${new URLSearchParams({ state: pendingState })}`, {
    Cookie: `${stateCookieName}=${pendingState}`
  });
  assert.equal(missingCode.status, 400);
  assert.deepEqual(f.calls.exchanges, []);
}));

test('pending OAuth challenges are bounded and expired entries are retired on the next login', () => {
  let clock = 1_800_000_000_000;
  return withAuthServer(async f => {
  for (let index = 0; index < 256; index += 1) {
    const result = await f.request('/api/auth/google/login');
    assert.equal(result.status, 302);
  }
  const full = await f.request('/api/auth/google/login');
  assert.equal(full.status, 503);
  assert.equal(full.headers['set-cookie'], undefined);

  clock += 600_001;
  const recovered = await f.request('/api/auth/google/login');
  assert.equal(recovered.status, 302);
}, { now: () => clock });

});


test('Google Photos service carries OAuth state only in the real provider authorization URL', () => {
  const servicePath = path.join(__dirname, 'services/googlePhotos.js');
  const module = { exports: {} };
  const nativeRequire = createRequire(servicePath);
  const cacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-google-oauth-'));
  const oldCachePath = process.env.LUMINA_GOOGLE_PHOTOS_CACHE_PATH;
  process.env.LUMINA_GOOGLE_PHOTOS_CACHE_PATH = path.join(cacheRoot, 'cache.json');

  try {
    compileFunction(fs.readFileSync(servicePath, 'utf8'), ['module', 'require', '__dirname'], { filename: servicePath })(
      module,
      name => name === '../config/env.js'
        ? { readEnvVar: name => ({ GOOGLE_CLIENT_ID: 'test-client-id' })[name] || '', persistEnvVars() {} }
        : nativeRequire(name),
      path.dirname(servicePath)
    );
    const state = 'a'.repeat(64);
    const url = new URL(module.exports.getGoogleAuthUrl(trustedRedirectUri, state));
    assert.equal(url.origin, 'https://accounts.google.com');
    assert.equal(url.searchParams.get('client_id'), 'test-client-id');
    assert.equal(url.searchParams.get('redirect_uri'), trustedRedirectUri);
    assert.equal(url.searchParams.get('state'), state);
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly');
  } finally {
    if (oldCachePath === undefined) delete process.env.LUMINA_GOOGLE_PHOTOS_CACHE_PATH;
    else process.env.LUMINA_GOOGLE_PHOTOS_CACHE_PATH = oldCachePath;
    fs.rmSync(cacheRoot, { recursive: true, force: true });
  }
});
