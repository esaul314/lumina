// @ts-check

const assert = require('assert');
const { createRecrawlJobService } = require('./recrawl.js');

function createState() {
  return {
    currentCategory: 'Scenic Nature',
    photosList: [{ url: 'old-1', category: 'Scenic Nature' }],
    feedConfigs: {
      'Scenic Nature': {
        reddit: { enabled: true, subreddits: ['EarthPorn'] }
      }
    },
    searchKeywords: {
      'Scenic Nature': ['forest']
    },
    excludedKeywords: []
  };
}

function createCollections() {
  return {
    'Scenic Nature': [{ url: 'old-1' }],
    'Liminal Spaces': [{ url: 'hall-1' }]
  };
}

function createDeferred() {
  /** @type {(value?: unknown) => void} */
  let resolve;
  /** @type {(reason?: unknown) => void} */
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function runRecrawlJobTests(assertAsyncTest) {
  await assertAsyncTest('recrawl job service runs one shared background pass and emits progress plus terminal events', async () => {
    const state = createState();
    const collections = createCollections();
    const emitted = [];
    let persisted = 0;
    let broadcasts = 0;
    let analyses = 0;

    const service = createRecrawlJobService({
      state,
      collections,
      io: {
        emit: (event, payload) => emitted.push({ event, payload })
      },
      crawlCollections: async () => ({
        updatedCollections: {
          'Scenic Nature': [{ url: 'fresh-1' }, { url: 'fresh-2' }]
        },
        updatedAny: true
      }),
      persistCollections: () => {
        persisted += 1;
      },
      buildActiveFeed: (categories, currentCollections) => categories.flatMap((category) =>
        (currentCollections[category] || []).map((photo) => ({ ...photo, category }))
      ),
      getActiveCategories: () => ['Scenic Nature'],
      broadcastStateSync: () => {
        broadcasts += 1;
      },
      triggerImageAnalysisBackground: async () => {
        analyses += 1;
      },
      now: (() => {
        let tick = 0;
        return () => new Date(`2026-07-09T12:00:0${tick++}Z`);
      })(),
      createJobId: () => 'job-1'
    });

    const submission = await service.submit({});
    await service.waitForIdle();

    assert.strictEqual(submission.reused, false);
    assert.strictEqual(submission.job.id, 'job-1');
    assert.strictEqual(persisted, 1);
    assert.strictEqual(broadcasts, 1);
    assert.strictEqual(analyses, 1);
    assert.deepStrictEqual(collections['Scenic Nature'], [
      { url: 'fresh-1', category: 'Scenic Nature' },
      { url: 'fresh-2', category: 'Scenic Nature' }
    ]);
    assert.deepStrictEqual(state.photosList, [
      { url: 'fresh-1', category: 'Scenic Nature' },
      { url: 'fresh-2', category: 'Scenic Nature' }
    ]);

    const statusEvents = emitted.filter(({ event }) => event === 'job-status');
    assert.ok(statusEvents.length >= 3, 'expected queued, running, and terminal job-status events');
    assert.strictEqual(statusEvents.at(-1)?.payload.status, 'succeeded');
    assert.deepStrictEqual(statusEvents.at(-1)?.payload.result, {
      categories: ['Scenic Nature', 'Liminal Spaces'],
      updatedAny: true,
      visibleCount: 2,
      categoryCounts: [
        { name: 'Scenic Nature', photoCount: 2 },
        { name: 'Liminal Spaces', photoCount: 1 }
      ]
    });

    const legacyComplete = emitted.findLast(({ event }) => event === 'recrawl-complete');
    assert.deepStrictEqual(legacyComplete?.payload, {
      success: true,
      count: 2
    });
  });

  await assertAsyncTest('recrawl job service reuses an active job instead of spawning overlapping runs', async () => {
    const state = createState();
    const collections = createCollections();
    const deferred = createDeferred();
    let crawlCalls = 0;

    const service = createRecrawlJobService({
      state,
      collections,
      io: { emit: () => {} },
      crawlCollections: async () => {
        crawlCalls += 1;
        await deferred.promise;
        return {
          updatedCollections: {},
          updatedAny: false
        };
      },
      persistCollections: () => {},
      buildActiveFeed: () => state.photosList,
      getActiveCategories: () => ['Scenic Nature'],
      broadcastStateSync: () => {},
      triggerImageAnalysisBackground: async () => {},
      createJobId: () => 'job-overlap'
    });

    const firstSubmission = await service.submit({});
    const secondSubmission = await service.submit({});
    deferred.resolve();
    await service.waitForIdle();

    assert.strictEqual(firstSubmission.job.id, 'job-overlap');
    assert.strictEqual(secondSubmission.job.id, 'job-overlap');
    assert.strictEqual(secondSubmission.reused, true);
    assert.strictEqual(crawlCalls, 1);
  });

  await assertAsyncTest('recrawl job service surfaces crawler failures as terminal job errors', async () => {
    const emitted = [];
    const service = createRecrawlJobService({
      state: createState(),
      collections: createCollections(),
      io: {
        emit: (event, payload) => emitted.push({ event, payload })
      },
      crawlCollections: async () => {
        throw new Error('crawler offline');
      },
      persistCollections: () => {},
      buildActiveFeed: () => [],
      getActiveCategories: () => ['Scenic Nature'],
      broadcastStateSync: () => {},
      triggerImageAnalysisBackground: async () => {}
    });

    await service.submit({});
    await service.waitForIdle();

    const latestStatus = emitted.filter(({ event }) => event === 'job-status').at(-1)?.payload;
    assert.strictEqual(latestStatus?.status, 'failed');
    assert.strictEqual(latestStatus?.error, 'crawler offline');

    const legacyComplete = emitted.findLast(({ event }) => event === 'recrawl-complete');
    assert.deepStrictEqual(legacyComplete?.payload, {
      success: false,
      error: 'crawler offline'
    });
  });
}

module.exports = {
  runRecrawlJobTests
};
