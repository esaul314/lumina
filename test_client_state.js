// Client-state/control and transport-boundary regressions.
// The existing runner owns reporting, counters, ordering and process exit.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { SOCKET_COMMAND_LISTENER_SPECS } = require('./server/domain/commands.js');
const { createSocketCommandSpecInterpreter } = require('./server/sockets.js');
const googlePhotos = require('./server/services/googlePhotos.js');
const { buildGooglePhotoProxyUrl } = googlePhotos;

async function runClientStateTests({
  logSuite, assertTest, assertAsyncTest, importClientModule, createSocketHarness
}) {
  logSuite('Remote Feed Control Snapshot Mutations');

  const {
    createEnvironmentDevice,
    convertPressure,
    convertTemperature,
    formatEnvironmentMetric,
    formatEnvironmentTimestamp,
    getActiveEnvironmentDevice,
    getEnvironmentStatus,
    normalizeEnvironmentSettingsDraft,
    removeEnvironmentDevice,
    selectEnvironmentDevice,
    upsertEnvironmentDevice,
    parseEnvironmentSettingsJson
  } = await importClientModule('./client/src/state/environmentHistory.js');

  assertTest('environment UI helpers present normalized sensor status and safe metric fallbacks', () => {
    assert.strictEqual(formatEnvironmentMetric(24.75, '°C'), '24.8°C');
    assert.strictEqual(formatEnvironmentMetric(null, '%'), '—');
    assert.strictEqual(convertTemperature(20, 'F'), 68);
    assert.strictEqual(convertTemperature('not-a-number', 'F'), null);
    assert.strictEqual(convertPressure(1013.25, 'hPa'), 1013.25);
    assert.strictEqual(convertPressure(1013.25, 'inHg'), 29.921255347112236);
    assert.strictEqual(formatEnvironmentTimestamp('not-a-timestamp'), 'No reading yet');
    assert.deepStrictEqual(getEnvironmentStatus({ enabled: true, stale: false, indoor: { temperatureC: 22 } }), {
      label: 'Online',
      color: '#10b981'
    });
    assert.strictEqual(getEnvironmentStatus(null).label, 'Backend unavailable');
    assert.deepStrictEqual(parseEnvironmentSettingsJson('{"enabled":true,"baseUrl":"http://gateway"}'), {
      valid: true,
      value: { enabled: true, baseUrl: 'http://gateway' }
    });
    assert.strictEqual(parseEnvironmentSettingsJson('[]').valid, false);
    assert.strictEqual(getEnvironmentStatus({ enabled: true, stale: true }).label, 'Stale fallback');
  });

  assertTest('environment device helpers add, select, edit, and remove saved profiles immutably', () => {
    const empty = normalizeEnvironmentSettingsDraft({ devices: [], units: { temperature: 'C' } });
    const first = createEnvironmentDevice(empty, { name: 'Living room', baseUrl: 'http://living.local' });
    const withFirst = upsertEnvironmentDevice(empty, first);
    const selected = selectEnvironmentDevice(withFirst, first.id);
    const renamed = upsertEnvironmentDevice(selected, { ...first, name: 'Main room' });
    const removed = removeEnvironmentDevice(renamed, first.id);

    assert.deepStrictEqual(empty.devices, []);
    assert.strictEqual(first.id, 'living-room');
    assert.strictEqual(getActiveEnvironmentDevice(selected).baseUrl, 'http://living.local');
    assert.strictEqual(renamed.devices[0].name, 'Main room');
    assert.strictEqual(removed.activeDeviceId, null);
    assert.deepStrictEqual(removed.devices, []);
  });

  const {
    applyPhotoEvent,
    getConfirmedPhotoPatch,
    normalizeSnapshot: normalizeClientSnapshot,
    normalizeSnapshotResponse,
    projectPhotoEvent
  } = await importClientModule('./client/src/state/frameSelectors.js');
  const { projectJobEvent, projectJobStatus } = await importClientModule('./client/src/state/jobStatus.js');
  const { projectCredentialSaveStatus } = await importClientModule('./client/src/state/credentialStatus.js');
  const credentialStatusSource = fs.readFileSync(
    path.join(__dirname, 'client/src/state/credentialStatus.js'),
    'utf8'
  );
  const {
    buildFieldPatch,
    buildWidgetVisibilityPatch
  } = await importClientModule('./client/src/state/actionPlans.js');
  const { buildMutationPlan } = await importClientModule('./client/src/api/requestPlans.js');
  const {
    createJsonUnavailableError,
    isJsonContentType,
    postJson,
    readJson
  } = await importClientModule('./client/src/api/jsonClient.js');

  assertTest('client state action plans are pure, partially applicable, and REST-shaped', () => {
    const buildThemePatch = buildFieldPatch('theme');
    const buildWidgetPatch = buildWidgetVisibilityPatch('clock');

    assert.deepStrictEqual(buildThemePatch('Cosmic Night'), { theme: 'Cosmic Night' });
    assert.deepStrictEqual(buildWidgetPatch(false), { widgets: { clock: false } });
    assert.deepStrictEqual(buildThemePatch(undefined), { theme: undefined });
  });

  assertTest('client action plans expose checked patch contracts', () => {
    const actionPlansSource = fs.readFileSync(
      path.join(__dirname, 'client/src/state/actionPlans.js'),
      'utf8'
    );

    assert.match(actionPlansSource, /^\/\/ @ts-check/);
    assert.match(actionPlansSource, /@typedef \{Record<string, unknown>\} StatePatch/);
    assert.match(
      actionPlansSource,
      /@typedef \{\{widgets: Record<string, boolean>\}\} WidgetVisibilityPatch/
    );
    assert.match(actionPlansSource, /@returns \{\(value: unknown\) => StatePatch\}/);
    assert.match(
      actionPlansSource,
      /@returns \{\(visible: boolean\) => WidgetVisibilityPatch\}/
    );
  });

  assertTest('client mutation plans keep REST and legacy payload projections declarative', () => {
    const buildCategoryPlan = buildMutationPlan({
      path: '/api/state/categories',
      event: 'change-category',
      body: (categories) => ({ categories })
    });
    const buildScreensaverPlan = buildMutationPlan({
      path: '/api/state/screensaver',
      event: 'set-screensaver-active',
      body: (active) => ({ active })
    });

    assert.deepStrictEqual(buildCategoryPlan('Scenic Nature,Liminal Spaces'), {
      path: '/api/state/categories',
      method: 'POST',
      body: { categories: 'Scenic Nature,Liminal Spaces' },
      legacy: {
        event: 'change-category',
        payload: 'Scenic Nature,Liminal Spaces'
      }
    });
    assert.deepStrictEqual(buildScreensaverPlan(false), {
      path: '/api/state/screensaver',
      method: 'POST',
      body: { active: false },
      legacy: {
        event: 'set-screensaver-active',
        payload: false
      }
    });
  });

  assertTest('client mutation plans expose a checked legacy transport contract', () => {
    const requestPlansSource = fs.readFileSync(
      path.join(__dirname, 'client/src/api/requestPlans.js'),
      'utf8'
    );

    assert.match(requestPlansSource, /^\/\/ @ts-check/);
    assert.match(requestPlansSource, /@typedef \{\{event: string, payload: unknown\}\} LegacyMutation/);
    assert.match(requestPlansSource, /legacy: LegacyMutation/);
    assert.match(requestPlansSource, /@typedef \{\{/);
    assert.match(requestPlansSource, /\}\} MutationPlanSpec/);
    assert.match(requestPlansSource, /@param \{MutationPlanSpec<Input>\} spec/);
    assert.match(requestPlansSource, /@returns \{\(input: Input\) => MutationPlan\}/);
  });

  assertTest('client JSON response contracts classify media types without transport state', () => {
    assert.strictEqual(isJsonContentType('application/json; charset=utf-8'), true);
    assert.strictEqual(isJsonContentType('application/problem+json'), true);
    assert.strictEqual(isJsonContentType('application/jsonp'), false);
    assert.strictEqual(isJsonContentType('text/html'), false);
    assert.strictEqual(createJsonUnavailableError(502).message, 'JSON API unavailable (502)');
  });

  assertTest('client JSON transport exposes checked payload and option contracts', () => {
    const jsonClientSource = fs.readFileSync(
      path.join(__dirname, 'client/src/api/jsonClient.js'),
      'utf8'
    );

    assert.match(jsonClientSource, /^\/\/ @ts-check/);
    assert.match(
      jsonClientSource,
      /@typedef \{\{ error\?: unknown, message\?: unknown \}\} ApiErrorPayload/
    );
    assert.match(
      jsonClientSource,
      /@typedef \{\{ method\?: string, body\?: unknown, requireJson\?: boolean \}\} JsonRequestOptions/
    );
    assert.match(jsonClientSource, /@type \{ApiErrorPayload\}/);
    assert.match(jsonClientSource, /@template Payload/);
    assert.match(jsonClientSource, /@param \{JsonRequestOptions\} \[options\]/);
    assert.match(jsonClientSource, /@returns \{Promise<Payload>\}/);
  });

  assertTest('client photo event projection updates the selected frame side immutably', () => {
    const snapshot = normalizeClientSnapshot({
      activePhoto: { url: 'primary-before' },
      activeSecondPhoto: { url: 'secondary-before' },
      currentFrame: {
        primary: { url: 'primary-before' },
        secondary: { url: 'secondary-before' },
        layout: 'split',
        crop: { primaryPercent: 40, secondaryPercent: 60 },
        context: { categories: ['Scenic Nature'] }
      }
    });
    const nextPrimary = { url: 'primary-after', title: 'Primary' };
    const nextSecondary = { url: 'secondary-after', title: 'Secondary' };

    const primaryResult = applyPhotoEvent(snapshot, 'primary', nextPrimary);
    const secondaryResult = applyPhotoEvent(snapshot, 'secondary', nextSecondary);

    assert.notStrictEqual(primaryResult, snapshot);
    assert.notStrictEqual(secondaryResult, snapshot);
    assert.deepStrictEqual(primaryResult.activePhoto, nextPrimary);
    assert.deepStrictEqual(primaryResult.currentFrame.primary, nextPrimary);
    assert.deepStrictEqual(primaryResult.currentFrame.secondary, snapshot.currentFrame.secondary);
    assert.deepStrictEqual(secondaryResult.activeSecondPhoto, nextSecondary);
    assert.deepStrictEqual(secondaryResult.currentFrame.secondary, nextSecondary);
    assert.deepStrictEqual(secondaryResult.currentFrame.primary, snapshot.currentFrame.primary);
    assert.deepStrictEqual(snapshot.activePhoto, { url: 'primary-before' });
    assert.deepStrictEqual(snapshot.activeSecondPhoto, { url: 'secondary-before' });
  });

  assertTest('client photo event projection preserves identity for missing snapshots or sides', () => {
    const snapshot = { activePhoto: { url: 'primary' } };

    assert.strictEqual(applyPhotoEvent(null, 'primary', { url: 'next' }), null);
    assert.strictEqual(applyPhotoEvent(snapshot, 'unknown', { url: 'next' }), snapshot);
  });

  assertTest('client photo event envelopes select the canonical frame side', () => {
    const primary = { url: 'primary' };
    const secondary = { url: 'secondary' };

    assert.deepStrictEqual(projectPhotoEvent('photo-update', primary), {
      side: 'primary',
      photo: primary
    });
    assert.deepStrictEqual(projectPhotoEvent('second-photo-update', secondary), {
      side: 'secondary',
      photo: secondary
    });
    assert.strictEqual(projectPhotoEvent('unknown-photo-event', primary), null);
    assert.strictEqual(projectPhotoEvent('toString', primary), null);
  });

  assertTest('client job status projection shares recrawl and vision state transitions', () => {
    assert.deepStrictEqual(projectJobStatus({
      type: 'recrawl',
      status: 'running',
      progress: { message: 'Fetching feeds' }
    }), {
      status: 'loading',
      message: 'Fetching feeds'
    });
    assert.deepStrictEqual(projectJobStatus({
      type: 'vision-analysis',
      status: 'succeeded',
      result: { taggedCount: 12 }
    }), {
      status: 'success',
      count: 12,
      message: 'Vision analysis completed successfully.',
      reset: true
    });
    assert.deepStrictEqual(projectJobStatus({
      type: 'recrawl',
      status: 'failed',
      error: 'Feed source unavailable'
    }), {
      status: 'error',
      message: 'Feed source unavailable',
      reset: true
    });
    assert.strictEqual(projectJobStatus({ type: 'unknown', status: 'running' }), null);
    assert.strictEqual(projectJobStatus({ type: 'toString', status: 'running' }), null);
    assert.strictEqual(projectJobStatus({ type: 'recrawl', status: 'cancelled' }), null);
    assert.deepStrictEqual(projectJobStatus({ type: 'recrawl', status: 'queued' }), {
      status: 'loading',
      message: 'Crawling web feeds & self-healing links...'
    });
    assert.strictEqual(projectJobStatus(null), null);
  });

  assertTest('client job event projection normalizes legacy recrawl completion', () => {
    assert.deepStrictEqual(projectJobEvent('job-status', {
      type: 'vision-analysis',
      status: 'running'
    }), {
      type: 'vision-analysis',
      update: {
        status: 'loading',
        message: 'Analyzing photo metadata...'
      }
    });
    assert.deepStrictEqual(projectJobEvent('recrawl-complete', {
      success: true,
      count: 18
    }), {
      type: 'recrawl',
      update: {
        status: 'success',
        count: 18,
        message: 'Feed recrawl completed successfully.',
        reset: true
      }
    });
    assert.deepStrictEqual(projectJobEvent('recrawl-complete', {
      success: false,
      error: 'Feed source unavailable'
    }), {
      type: 'recrawl',
      update: {
        status: 'error',
        message: 'Feed source unavailable',
        reset: true
      }
    });
    assert.strictEqual(projectJobEvent('unknown', {}), null);
    assert.deepStrictEqual(projectJobEvent('job-status', null), {
      type: undefined,
      update: null
    });
  });

  assertTest('credential save acknowledgements share a pure status projection', () => {
    assert.deepStrictEqual(projectCredentialSaveStatus({ success: true }), {
      status: 'success',
      clearInput: true
    });
    assert.deepStrictEqual(projectCredentialSaveStatus({ success: false }), {
      status: 'error',
      clearInput: false
    });
    assert.strictEqual(projectCredentialSaveStatus({ success: 'true' }), null);
    assert.strictEqual(projectCredentialSaveStatus(null), null);
  });

  assertTest('credential save status exposes a checked unknown-safe contract', () => {
    assert.strictEqual(projectCredentialSaveStatus({ success: undefined }), null);
    assert.strictEqual(projectCredentialSaveStatus('not-an-acknowledgement'), null);
    assert.match(credentialStatusSource, /^\/\/ @ts-check/);
    assert.match(
      credentialStatusSource,
      /@typedef \{\{status: 'success'\|'error', clearInput: boolean\}\} CredentialSaveStatus/
    );
    assert.match(credentialStatusSource, /@param \{unknown\} response/);
    assert.match(credentialStatusSource, /@returns \{CredentialSaveStatus\|null\}/);
  });

  assertTest('photo mutation UI reconciles source-local metadata from the server response', () => {
    assert.deepStrictEqual(
      getConfirmedPhotoPatch('requested-url', { loved: true }, {
        photo: { url: '/api/google-photos/media/picker-1?w=2560&h=1440', loved: true }
      }),
      {
        url: '/api/google-photos/media/picker-1?w=2560&h=1440',
        patch: { loved: true }
      }
    );
    assert.deepStrictEqual(
      getConfirmedPhotoPatch('requested-url', { loved: false }, null),
      { url: 'requested-url', patch: { loved: false } }
    );
  });

  const {
    applyCategorySelection,
    applyFeedSourceConfigPatch,
    getSelectedCategories,
    isCategorySelected,
    normalizeCategorySelection,
    serializeCategorySelection,
    toggleCategorySelection
  } = await importClientModule('./client/src/state/feedMutations.js');
  const { normalizeCategoryName } = await importClientModule('./client/src/state/categorySelection.js');

  assertTest('toggleCategorySelection normalizes commas and toggles without duplicating categories', () => {
    const sourceSelection = [' Scenic Nature ', 'Liminal Space', 'Liminal Space'];

    assert.deepStrictEqual(
      toggleCategorySelection('Liminal Spaces', 'Scenic Nature, Liminal Spaces'),
      ['Scenic Nature']
    );
    assert.deepStrictEqual(
      toggleCategorySelection('AI Creations', 'Scenic Nature, Liminal Spaces'),
      ['Scenic Nature', 'Liminal Spaces', 'AI Creations']
    );
    assert.deepStrictEqual(
      normalizeCategorySelection(' Scenic Nature , Scenic Nature ,AI Creations '),
      ['Scenic Nature', 'AI Creations']
    );
    assert.strictEqual(
      serializeCategorySelection([' Scenic Nature ', 'AI Creations', 'Scenic Nature']),
      'Scenic Nature,AI Creations'
    );
    assert.strictEqual(normalizeCategoryName('AI Creation'), 'AI Creations');
    assert.deepStrictEqual(normalizeCategorySelection(sourceSelection), [
      'Scenic Nature',
      'Liminal Spaces'
    ]);
    assert.deepStrictEqual(sourceSelection, [' Scenic Nature ', 'Liminal Space', 'Liminal Space']);
  });

  assertTest('client category helpers prefer canonical playback selection over stale top-level category strings', () => {
    const snapshot = {
      currentCategory: 'Scenic Nature',
      currentFrame: {
        context: {
          categories: ['AI Creation']
        }
      },
      playback: {
        selectedCategories: ['Liminal Space', 'Google Photos']
      }
    };

    assert.deepStrictEqual(
      getSelectedCategories(snapshot),
      ['Liminal Spaces', 'Google Photos']
    );
    assert.strictEqual(isCategorySelected(snapshot, 'Liminal Spaces'), true);
    assert.strictEqual(isCategorySelected(snapshot, 'AI Creations'), false);
    assert.deepStrictEqual(
      toggleCategorySelection('AI Creations', snapshot),
      ['Liminal Spaces', 'Google Photos', 'AI Creations']
    );
  });

  assertTest('normalizeSnapshot reconciles currentCategory with canonical playback selection', () => {
    const nextSnapshot = normalizeClientSnapshot({
      currentCategory: 'Scenic Nature',
      currentFrame: {
        layout: 'single',
        primary: { url: 'land-1', category: 'Google Photos' },
        secondary: null,
        crop: {
          primaryPercent: 100,
          primaryPositionY: 50,
          secondaryPercent: 50,
          secondaryPositionY: 50
        },
        context: {
          category: 'Google Photos',
          categories: ['AI Creation'],
          photoCount: 1,
          orientation: 'landscape',
          splitEligible: false
        }
      },
      playback: {
        selectedCategories: ['Liminal Space', 'Google Photos']
      }
    });

    assert.strictEqual(nextSnapshot.currentCategory, 'Liminal Spaces,Google Photos');
    assert.deepStrictEqual(nextSnapshot.playback.selectedCategories, ['Liminal Spaces', 'Google Photos']);
    assert.deepStrictEqual(nextSnapshot.currentFrame.context.categories, ['Liminal Spaces', 'Google Photos']);
  });

  assertTest('normalizeSnapshotResponse composes direct and mutation response snapshots without mutation', () => {
    const sourceSnapshot = {
      currentCategory: 'Scenic Nature',
      playback: { selectedCategories: ['Liminal Space'] },
      activePhoto: { url: 'land-1' }
    };
    const direct = normalizeSnapshotResponse(sourceSnapshot);
    const enveloped = normalizeSnapshotResponse({ state: sourceSnapshot });

    assert.deepStrictEqual(enveloped, direct);
    assert.deepStrictEqual(sourceSnapshot, {
      currentCategory: 'Scenic Nature',
      playback: { selectedCategories: ['Liminal Space'] },
      activePhoto: { url: 'land-1' }
    });
    assert.strictEqual(normalizeSnapshotResponse(null), null);
    assert.strictEqual(normalizeSnapshotResponse(undefined), undefined);
  });

  assertTest('applyCategorySelection patches both top-level and nested playback selection state', () => {
    const snapshot = {
      currentCategory: 'Scenic Nature',
      currentFrame: {
        layout: 'single',
        primary: { url: 'land-1' },
        secondary: null,
        crop: {
          primaryPercent: 100,
          primaryPositionY: 50,
          secondaryPercent: 50,
          secondaryPositionY: 50
        },
        context: {
          category: 'Scenic Nature',
          categories: ['Scenic Nature'],
          photoCount: 1,
          orientation: 'landscape',
          splitEligible: false
        }
      },
      playback: {
        selectedCategories: ['Scenic Nature'],
        activePhotoUrl: 'land-1',
        splitSeed: 0,
        lastDirection: 'next'
      }
    };

    const nextSnapshot = applyCategorySelection(snapshot, 'Scenic Nature,Liminal Spaces');
    assert.strictEqual(nextSnapshot.currentCategory, 'Scenic Nature,Liminal Spaces');
    assert.deepStrictEqual(nextSnapshot.playback.selectedCategories, ['Scenic Nature', 'Liminal Spaces']);
    assert.deepStrictEqual(nextSnapshot.currentFrame.context.categories, ['Scenic Nature', 'Liminal Spaces']);
    assert.deepStrictEqual(snapshot.playback.selectedCategories, ['Scenic Nature']);
    assert.deepStrictEqual(snapshot.currentFrame.context.categories, ['Scenic Nature']);
    assert.strictEqual(applyCategorySelection(null, 'Scenic Nature'), null);
  });

  assertTest('applyFeedSourceConfigPatch merges source patches without dropping sibling fields', () => {
    const snapshot = {
      feedConfigs: {
        'Scenic Nature': {
          reddit: { enabled: false, subreddits: ['EarthPorn'] }
        }
      },
      config: {
        feedConfigs: {
          'Scenic Nature': {
            reddit: { enabled: false, subreddits: ['EarthPorn'] }
          }
        }
      }
    };

    const nextSnapshot = applyFeedSourceConfigPatch(snapshot, 'Scenic Nature', 'reddit', {
      enabled: true,
      subreddits: ['SkyPorn']
    });

    assert.deepStrictEqual(nextSnapshot.feedConfigs['Scenic Nature'].reddit, {
      enabled: true,
      subreddits: ['SkyPorn']
    });
    assert.deepStrictEqual(nextSnapshot.config.feedConfigs['Scenic Nature'].reddit, {
      enabled: true,
      subreddits: ['SkyPorn']
    });
    assert.deepStrictEqual(snapshot.feedConfigs['Scenic Nature'].reddit, {
      enabled: false,
      subreddits: ['EarthPorn']
    });
    assert.strictEqual(applyFeedSourceConfigPatch(snapshot, '', 'reddit', {}), snapshot);
    assert.strictEqual(applyFeedSourceConfigPatch(snapshot, 'Scenic Nature', '', {}), snapshot);
    assert.strictEqual(applyFeedSourceConfigPatch(snapshot, 'Scenic Nature', 'reddit', null), snapshot);
  });

  const originalWindow = global.window;
  const originalFetch = global.fetch;

  try {
    global.window = {
      location: {
        port: '5000',
        protocol: 'http:',
        hostname: '127.0.0.1',
        origin: 'http://127.0.0.1:5000'
      }
    };

    const {
      getStateSnapshot: getClientStateSnapshot,
      saveUseApiToken: saveClientUseApiToken,
      selectCategories: selectClientCategories,
      setScreensaverActive: setClientScreensaverActive,
      startRecrawlJob: startClientRecrawlJob,
      startVisionAnalysisJob: startClientVisionAnalysisJob
    } = await importClientModule('./client/src/api/luminaClient.js');

    const requestCalls = [];
    global.fetch = async (url, options) => {
      requestCalls.push({ url, options });
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json; charset=utf-8' },
        json: async () => ({ success: true })
      };
    };
    const readResult = await readJson('/api/environment');
    const postResult = await postJson('/api/environment/settings', { enabled: true });

    assertTest('shared client JSON transport keeps read and post effects at one boundary', () => {
      assert.deepStrictEqual(readResult, { success: true });
      assert.deepStrictEqual(postResult, { success: true });
      assert.deepStrictEqual(requestCalls, [
        {
          url: 'http://127.0.0.1:5000/api/environment',
          options: { method: 'GET', headers: undefined, body: undefined }
        },
        {
          url: 'http://127.0.0.1:5000/api/environment/settings',
          options: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true })
          }
        }
      ]);
    });

    global.fetch = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      json: async () => ({})
    });
    await assertAsyncTest('shared read contract rejects an HTML response before view-specific presentation', async () => {
      await assert.rejects(readJson('/api/environment'), /JSON API unavailable \(200\)/);
    });
    await assertAsyncTest('state snapshot reads use the shared strict JSON contract', async () => {
      await assert.rejects(getClientStateSnapshot(), /JSON API unavailable \(200\)/);
    });

    const emittedEvents = [];
    global.fetch = async () => ({
      ok: false,
      status: 404,
      json: async () => ({})
    });
    const fallbackResult = await selectClientCategories('Scenic Nature,Liminal Spaces', {
      socket: {
        emit: (...args) => emittedEvents.push(args)
      }
    });
    const fallbackSecretResult = await saveClientUseApiToken('secret-123', {
      socket: {
        emit: (...args) => emittedEvents.push(args)
      }
    });
    const fallbackScreensaverResult = await setClientScreensaverActive(false, {
      socket: {
        emit: (...args) => emittedEvents.push(args)
      }
    });
    const fallbackRecrawlResult = await startClientRecrawlJob({ categories: ['Scenic Nature'] }, {
      socket: {
        emit: (...args) => emittedEvents.push(args)
      }
    });
    const fallbackVisionResult = await startClientVisionAnalysisJob({ categories: ['Scenic Nature'] }, {
      socket: {
        emit: (...args) => emittedEvents.push(args)
      }
    });

    assertTest('selectCategories falls back to the legacy socket event when the REST route is missing', () => {
      assert.strictEqual(fallbackResult, null);
      assert.deepStrictEqual(emittedEvents[0], [
        ['change-category', 'Scenic Nature,Liminal Spaces']
      ][0]);
    });

    assertTest('saveUseApiToken falls back to the legacy socket event when the REST route is missing', () => {
      assert.strictEqual(fallbackSecretResult, null);
      assert.deepStrictEqual(emittedEvents[1], ['save-useapi-token', { token: 'secret-123' }]);
    });

    assertTest('the shared client fallback adapter preserves screensaver and job legacy events', () => {
      assert.deepStrictEqual([
        fallbackScreensaverResult,
        fallbackRecrawlResult,
        fallbackVisionResult
      ], [null, null, null]);
      assert.deepStrictEqual(emittedEvents.slice(2), [
        ['set-screensaver-active', false],
        ['trigger-recrawl', { categories: ['Scenic Nature'] }],
        ['trigger-vision-analysis', { categories: ['Scenic Nature'] }]
      ]);
    });

    global.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'server unavailable' })
    });
    await assertAsyncTest('the shared client fallback adapter rethrows non-404 REST failures', async () => {
      await assert.rejects(
        setClientScreensaverActive(false, {
          socket: {
            emit: () => { throw new Error('socket fallback should not run'); }
          }
        }),
        /server unavailable/
      );
    });
  } finally {
    global.window = originalWindow;
    global.fetch = originalFetch;
  }

  const socketFamilyEmits = [];
  const compatibilityFallback = () => 'legacy-state-patch';
  const interpretSocketFamily = createSocketCommandSpecInterpreter({
    compatibility: {
      statePatch: compatibilityFallback,
      categorySelection: () => 'legacy-category'
    },
    emitSecretSaveResult: () => {},
    socket: {
      emit: (...args) => socketFamilyEmits.push(args)
    }
  });

  assertTest('socket command-family interpreter keeps its declared vocabulary closed', () => {
    const statePatch = interpretSocketFamily({ family: 'state-patch', event: 'change-theme' });
    const durableCommand = interpretSocketFamily({
      family: 'durable-command',
      event: 'change-category',
      decode: (payload) => ({ type: 'select-categories', payload }),
      fallbackKey: 'categorySelection'
    });
    const asyncJob = interpretSocketFamily({
      family: 'async-job',
      event: 'trigger-recrawl',
      decode: () => ({ type: 'request-recrawl' }),
      unavailableEvent: 'recrawl-complete',
      unavailablePayload: { success: false }
    });
    const unknown = interpretSocketFamily({ family: 'unknown-family', event: 'custom' });
    const inherited = interpretSocketFamily({ family: '__proto__', event: 'custom-inherited' });

    assert.strictEqual(statePatch.fallback, compatibilityFallback);
    assert.deepStrictEqual(durableCommand.decode(['Scenic Nature']), {
      type: 'select-categories',
      payload: ['Scenic Nature']
    });
    assert.strictEqual(durableCommand.fallback(), 'legacy-category');
    asyncJob.fallback();
    assert.deepStrictEqual(socketFamilyEmits, [['recrawl-complete', { success: false }]]);
    assert.deepStrictEqual(unknown, { event: 'custom' });
    assert.deepStrictEqual(inherited, { event: 'custom-inherited' });
  });

  const dispatchedCommands = [];
  const dispatchHarness = createSocketHarness({
    dispatchCommand: async (command) => {
      dispatchedCommands.push(command);
      return null;
    }
  });

  await dispatchHarness.socketHandlers['change-category']('Scenic Nature,Liminal Spaces');
  await dispatchHarness.socketHandlers['rate-photo']({ url: 'land-1', rating: 7 });
  await dispatchHarness.socketHandlers['mark-photo-broken']({ url: 'land-1' });
  await dispatchHarness.socketHandlers['set-photo-crop']({
    url: buildGooglePhotoProxyUrl('picker-123'),
    cropPercent: 62
  });
  await dispatchHarness.socketHandlers['update-keywords']({ category: 'Scenic Nature', keywords: ['forest', 'mist'] });
  await dispatchHarness.socketHandlers['update-feed-config']({
    category: 'Scenic Nature',
    source: 'reddit',
    config: {
      enabled: false,
      subreddits: ['CityPorn']
    }
  });
  await dispatchHarness.socketHandlers['update-excluded-keywords'](['forest', ' mist ']);
  await dispatchHarness.socketHandlers['save-useapi-token']({ token: 'secret-123' });

  assertTest('socket category, pool, photo, excluded-keyword, Google Photos, and admin compatibility events dispatch shared domain commands when available', () => {
    assert.deepStrictEqual(dispatchedCommands, [
      {
        type: 'select-categories',
        payload: {
          categories: 'Scenic Nature,Liminal Spaces'
        }
      },
      {
        type: 'rate-photo',
        payload: {
          url: 'land-1',
          rating: 7
        }
      },
      {
        type: 'mark-photo-broken',
        payload: {
          url: 'land-1'
        }
      },
      {
        type: 'set-photo-crop',
        payload: {
          url: buildGooglePhotoProxyUrl('picker-123'),
          cropPercent: 62
        }
      },
      {
        type: 'set-pool-keywords',
        payload: {
          name: 'Scenic Nature',
          keywords: ['forest', 'mist']
        }
      },
      {
        type: 'merge-pool-feed-config',
        payload: {
          name: 'Scenic Nature',
          source: 'reddit',
          config: {
            enabled: false,
            subreddits: ['CityPorn']
          }
        }
      },
      {
        type: 'update-excluded-keywords',
        payload: {
          keywords: ['forest', ' mist ']
        }
      },
      {
        type: 'save-env-secret',
        payload: {
          envKey: 'USEAPI_TOKEN',
          runtimeFlag: 'hasUseApiToken',
          value: 'secret-123'
        }
      }
    ]);
    assert.deepStrictEqual(
      dispatchHarness.socketEmits.find(([event]) => event === 'useapi-token-saved'),
      ['useapi-token-saved', { success: true }]
    );
  });

  assertTest('socket shared listener-spec table registers every shared command handler', () => {
    const missingEvents = SOCKET_COMMAND_LISTENER_SPECS
      .map(({ event }) => event)
      .filter((event) => typeof dispatchHarness.socketHandlers[event] !== 'function');

    assert.deepStrictEqual(missingEvents, []);
  });

  const statePatchCommands = [];
  const statePatchHarness = createSocketHarness({
    dispatchCommand: async (command) => {
      statePatchCommands.push(command);
      return null;
    }
  });
  await statePatchHarness.socketHandlers['change-theme'](' Cosmic Night ');
  await statePatchHarness.socketHandlers['toggle-auto-location'](true);
  await statePatchHarness.socketHandlers['toggle-widget']({ widgetName: 'clock', visible: 0 });

  assertTest('socket state-patch listener specs dispatch shared patch-state commands declaratively', () => {
    assert.deepStrictEqual(statePatchCommands, [
      {
        type: 'patch-state',
        payload: {
          theme: 'Cosmic Night'
        }
      },
      {
        type: 'patch-state',
        payload: {
          autoLocation: true
        }
      },
      {
        type: 'patch-state',
        payload: {
          widgets: {
            clock: 0
          }
        }
      }
    ]);
  });

  const fallbackHarness = createSocketHarness();
  await fallbackHarness.socketHandlers['update-keywords']({
    category: 'Scenic Nature',
    keywords: ['forest', 'mist']
  });
  await fallbackHarness.socketHandlers['update-feed-config']({
    category: 'Scenic Nature',
    source: 'reddit',
    config: { enabled: false }
  });
  await fallbackHarness.socketHandlers['update-pool-policy']({
    category: 'Scenic Nature',
    policy: { retentionDays: 14, maxPhotos: 500 }
  });
  const poolFallbackBroadcasts = fallbackHarness.ioEmits.length;
  await fallbackHarness.socketHandlers['update-keywords']({
    category: 'Missing Pool',
    keywords: ['ignored']
  });

  assertTest('legacy pool compatibility mutations share persistence and broadcast boundaries', () => {
    assert.deepStrictEqual(fallbackHarness.state.searchKeywords['Scenic Nature'], ['forest', 'mist']);
    assert.deepStrictEqual(fallbackHarness.state.feedConfigs['Scenic Nature'].reddit, { enabled: false });
    assert.deepStrictEqual(fallbackHarness.state.poolPolicies['Scenic Nature'], {
      retentionDays: 14,
      maxPhotos: 500,
      schedule: {
        enabled: false,
        start: '22:00',
        end: '06:00',
        priority: 0
      }
    });
    assert.strictEqual(fallbackHarness.ioEmits.length, poolFallbackBroadcasts);
    assert.strictEqual(fallbackHarness.state.searchKeywords['Missing Pool'], undefined);
  });

  const photoFallbackHarness = createSocketHarness();
  const photoBroadcastStart = photoFallbackHarness.ioEmits.length;
  await photoFallbackHarness.socketHandlers['rate-photo']({
    url: 'land-1',
    rating: 7
  });
  await photoFallbackHarness.socketHandlers['set-photo-crop']({
    url: 'land-1',
    cropPercent: 62
  });
  await photoFallbackHarness.socketHandlers['set-photo-prevent-pairing']({
    url: 'land-1',
    preventPairing: true
  });
  const photoBroadcastsAfterMutations = photoFallbackHarness.ioEmits.length;
  await photoFallbackHarness.socketHandlers['mark-photo-broken']({
    url: 'missing-photo'
  });

  assertTest('legacy photo compatibility mutations share the broadcast boundary and keep broken-photo no-ops silent', () => {
    assert.strictEqual(photoBroadcastsAfterMutations - photoBroadcastStart, 3);
    assert.deepStrictEqual(photoFallbackHarness.state.photosList[0], {
      url: 'land-1',
      title: 'Forest',
      rating: 7,
      cropPercent: 62,
      preventPairing: true
    });
    assert.strictEqual(photoFallbackHarness.ioEmits.length, photoBroadcastsAfterMutations);
  });

  await fallbackHarness.socketHandlers['next-photo']();

  assertTest('socket next-photo fallback still advances the active photo through the legacy smart selector', () => {
    assert.deepStrictEqual(fallbackHarness.state.activePhoto, {
      url: 'next-smart',
      title: 'next smart'
    });
    assert.deepStrictEqual(
      fallbackHarness.ioEmits.find(([event]) => event === 'photo-update'),
      ['photo-update', { url: 'next-smart', title: 'next smart' }]
    );
  });

  const excludedKeywordsFallbackHarness = createSocketHarness({
    combineFeedsBalanced: () => [{ url: 'replacement', title: 'Fresh Skyline' }]
  });
  await excludedKeywordsFallbackHarness.socketHandlers['update-excluded-keywords'](['  forest  ', '', 'mist']);

  assertTest('socket excluded-keywords fallback still normalizes the list and reselects away from excluded active photos', () => {
    assert.deepStrictEqual(excludedKeywordsFallbackHarness.state.excludedKeywords, ['forest', 'mist']);
    assert.deepStrictEqual(excludedKeywordsFallbackHarness.state.photosList, [{
      url: 'replacement',
      title: 'Fresh Skyline'
    }]);
    assert.deepStrictEqual(excludedKeywordsFallbackHarness.state.activePhoto, {
      url: 'replacement',
      title: 'Fresh Skyline'
    });
    assert.deepStrictEqual(
      excludedKeywordsFallbackHarness.ioEmits.findLast(([event]) => event === 'state-sync'),
      ['state-sync', excludedKeywordsFallbackHarness.state]
    );
  });

  const telemetryHarness = createSocketHarness({
    resolveTvDisplayInfo: async () => ({ name: 'HDMI-1', width: 3840, height: 2160 }),
    refreshGooglePhotoUrl: async (mediaItemId) => `https://photos.example/${mediaItemId}`
  });
  await telemetryHarness.socketHandlers['report-tv-viewport']({ width: 1920, height: 1080 });
  await telemetryHarness.socketHandlers['get-active-google-photo']({ mediaItemId: 'picker-123' });

  assertTest('socket telemetry listeners keep viewport reporting explicit and lazy-load display info once', () => {
    assert.deepStrictEqual(telemetryHarness.state.tvViewport, {
      width: 1920,
      height: 1080,
      aspectRatio: 1920 / 1080,
      updatedAt: telemetryHarness.state.tvViewport.updatedAt
    });
    assert.deepStrictEqual(telemetryHarness.state.tvDisplayInfo, {
      name: 'HDMI-1',
      width: 3840,
      height: 2160
    });
    assert.strictEqual(typeof telemetryHarness.state.tvViewport.updatedAt, 'number');
    assert.deepStrictEqual(
      telemetryHarness.ioEmits.findLast(([event]) => event === 'state-sync'),
      ['state-sync', telemetryHarness.state]
    );
  });

  assertTest('socket Google Photos refresh listener responds through the dedicated async adapter', () => {
    assert.deepStrictEqual(
      telemetryHarness.socketEmits.findLast(([event]) => event === 'active-google-photo-response'),
      ['active-google-photo-response', {
        mediaItemId: 'picker-123',
        url: 'https://photos.example/picker-123'
      }]
    );
  });

  const failedRefreshHarness = createSocketHarness({
    refreshGooglePhotoUrl: async () => {
      throw new Error('refresh unavailable');
    }
  });
  await failedRefreshHarness.socketHandlers['get-active-google-photo']({ mediaItemId: 'picker-failed' });

  assertTest('socket Google Photos refresh failures stay inside the shared async boundary', () => {
    assert.deepStrictEqual(
      failedRefreshHarness.socketEmits.findLast(([event]) => event === 'active-google-photo-response'),
      ['active-google-photo-response', {
        mediaItemId: 'picker-failed',
        error: 'refresh unavailable'
      }]
    );
  });

  const googleFallbackHarness = createSocketHarness();
  const originalIsGooglePhotoProxyUrl = googlePhotos.isGooglePhotoProxyUrl;
  const originalUpdateCachedMediaItemMetadata = googlePhotos.updateCachedMediaItemMetadata;
  const originalApplyCachedMediaItemMetadataToState = googlePhotos.applyCachedMediaItemMetadataToState;
  const googleFallbackUrl = buildGooglePhotoProxyUrl('picker-fallback');

  try {
    googlePhotos.isGooglePhotoProxyUrl = (value) => value === googleFallbackUrl;
    googlePhotos.updateCachedMediaItemMetadata = (value, metadata) => (
      value === googleFallbackUrl
        ? { id: 'picker-fallback', url: googleFallbackUrl, ...metadata }
        : null
    );
    googlePhotos.applyCachedMediaItemMetadataToState = (state, value, metadata) => {
      if (value !== googleFallbackUrl) {
        return null;
      }

      state.photosList = [{
        id: 'picker-fallback',
        url: googleFallbackUrl,
        title: 'Picker Photo',
        ...metadata
      }];
      state.activePhoto = { ...state.photosList[0] };
      return state.activePhoto;
    };

    await googleFallbackHarness.socketHandlers['set-photo-crop']({
      url: googleFallbackUrl,
      cropPercent: 48
    });

    assertTest('socket Google Photos fallback still applies source-local metadata when the shared dispatcher is unavailable', () => {
      assert.strictEqual(googleFallbackHarness.state.photosList[0].cropPercent, 48);
      assert.strictEqual(googleFallbackHarness.state.activePhoto.cropPercent, 48);
      assert.deepStrictEqual(
        googleFallbackHarness.ioEmits.findLast(([event]) => event === 'state-sync'),
        ['state-sync', googleFallbackHarness.state]
      );
    });
  } finally {
    googlePhotos.isGooglePhotoProxyUrl = originalIsGooglePhotoProxyUrl;
    googlePhotos.updateCachedMediaItemMetadata = originalUpdateCachedMediaItemMetadata;
    googlePhotos.applyCachedMediaItemMetadataToState = originalApplyCachedMediaItemMetadataToState;
  }

  const asyncFallbackHarness = createSocketHarness();
  await asyncFallbackHarness.socketHandlers['trigger-recrawl']({});
  await asyncFallbackHarness.socketHandlers['trigger-vision-analysis']({});

  assertTest('socket async job fallback listeners emit explicit failure payloads when no dispatcher is available', () => {
    assert.deepStrictEqual(
      asyncFallbackHarness.socketEmits.findLast(([event]) => event === 'recrawl-complete'),
      ['recrawl-complete', { success: false, error: 'Recrawl dispatcher unavailable.' }]
    );
    assert.deepStrictEqual(
      asyncFallbackHarness.socketEmits.findLast(([event]) => event === 'job-status'),
      ['job-status', {
        type: 'vision-analysis',
        status: 'failed',
        error: 'Vision-analysis dispatcher unavailable.'
      }]
    );
  });

  const secretFailureHarness = createSocketHarness({
    dispatchCommand: async (command) => {
      if (command.type === 'save-env-secret') {
        throw new Error('persist failed');
      }
      return null;
    }
  });
  await secretFailureHarness.socketHandlers['save-tumblr-api-key']({ value: 'tumblr-secret' });

  assertTest('socket secret-save listener specs acknowledge shared command failures without throwing', () => {
    assert.deepStrictEqual(
      secretFailureHarness.socketEmits.findLast(([event]) => event === 'tumblr-api-key-saved'),
      ['tumblr-api-key-saved', { success: false, error: 'persist failed' }]
    );
  });
}

module.exports = { runClientStateTests };
