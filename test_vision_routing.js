const assert = require('assert');
const {
  discoverVisionModel,
  isVisionModelId,
  normalizeApiBaseUrl
} = require('./server/services/vision.js');

const originalFetch = global.fetch;

async function run() {
  assert.strictEqual(normalizeApiBaseUrl(' http://router/v1/ '), 'http://router/v1');
  assert.strictEqual(isVisionModelId('qwen3-vl-8b-local'), true);
  assert.strictEqual(isVisionModelId('qwen3-14b-local'), false);

  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      data: [
        { id: 'qwen3-14b-local' },
        { id: 'qwen3-vl-8b-local' }
      ]
    })
  });

  assert.strictEqual(
    await discoverVisionModel('http://router/v1', 'qwen3-vl-8b-local'),
    'qwen3-vl-8b-local'
  );
  assert.strictEqual(
    await discoverVisionModel('http://router/v1', 'stale-vlm-route'),
    'qwen3-vl-8b-local'
  );

  global.fetch = async () => ({
    ok: true,
    json: async () => ({ data: [{ id: 'qwen3-14b-local' }] })
  });
  assert.strictEqual(await discoverVisionModel('http://router/v1', 'stale-vlm-route'), null);
  console.log('vision routing tests passed');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    global.fetch = originalFetch;
  });
