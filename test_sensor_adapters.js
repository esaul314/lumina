// @ts-check

const assert = require('assert');
const {
  normalizeMetricId,
  parseEcowittPayload
} = require('./server/services/ecowitt.js');
const { createSensorPlatform } = require('./server/services/sensorPlatform.js');
const {
  createDeviceId,
  decodeEnvironmentSettings,
  normalizeEnvironmentSettings,
  projectLegacySettings,
  removeDevice,
  selectDevice,
  upsertDevice,
  validateEnvironmentSettings
} = require('./server/domain/environmentSettings.js');

const tests = [
  {
    name: 'parses common_list-only indoor metrics with mixed identifier and unit formats',
    run: () => {
      assert.deepStrictEqual(parseEcowittPayload({
        common_list: [
          { id: '0x01', val: '72.5', unit: 'F' },
          { id: 6, val: '48%', unit: '%' },
          { id: '0x08', val: '1001.2 hPa', unit: 'hPa' },
          { id: '09', val: '29.91 inHg', unit: 'inHg' }
        ]
      }), {
        temperatureC: 22.5,
        humidityPercent: 48,
        pressureAbsoluteHpa: 1001.2,
        pressureRelativeHpa: 1012.9
      });
    }
  },
  {
    name: 'keeps the verified wh25 representation authoritative when both payload forms exist',
    run: () => {
      assert.deepStrictEqual(parseEcowittPayload({
        wh25: [{ intemp: '23.4', unit: 'C', inhumi: '51%', abs: '998.1 hPa', rel: '1015.6 hPa' }],
        common_list: [
          { id: '0x01', val: '10', unit: 'C' },
          { id: '0x06', val: '20', unit: '%' },
          { id: '0x08', val: '900', unit: 'hPa' },
          { id: '0x09', val: '901', unit: 'hPa' }
        ]
      }), {
        temperatureC: 23.4,
        humidityPercent: 51,
        pressureAbsoluteHpa: 998.1,
        pressureRelativeHpa: 1015.6
      });
    }
  },
  {
    name: 'normalizes decimal and hexadecimal Ecowitt metric identifiers',
    run: () => {
      assert.strictEqual(normalizeMetricId('0x09'), 9);
      assert.strictEqual(normalizeMetricId('09'), 9);
      assert.strictEqual(normalizeMetricId(9), 9);
      assert.strictEqual(normalizeMetricId('not-an-id'), null);
    }
  },
  {
    name: 'resolves canonical and legacy adapter identifiers to one primary runtime',
    run: async () => {
      const read = async () => ({ source: 'ecowitt-gw1200' });
      Object.defineProperty(read, 'adapterDescriptor', {
        value: {
          id: 'ecowitt-local-http',
          aliases: ['ecowitt-gw1200'],
          label: 'Ecowitt-compatible LAN gateway',
          capabilities: ['temperature']
        }
      });
      const platform = createSensorPlatform({
        adapters: [{
          id: 'ecowitt-gw1200',
          label: 'Legacy label',
          read,
          validateSettings: settings => ({ valid: Boolean(settings.baseUrl), settings })
        }],
        primaryAdapterId: 'ecowitt-gw1200'
      });

      assert.strictEqual(platform.getAdapter('ecowitt-local-http'), platform.getAdapter('ecowitt-gw1200'));
      assert.strictEqual(platform.getPrimaryAdapter()?.id, 'ecowitt-local-http');
      assert.deepStrictEqual(await platform.readPrimary(), { source: 'ecowitt-gw1200' });
      assert.strictEqual(platform.validateSettings('ecowitt-local-http', { baseUrl: 'http://gateway' }).valid, true);
      assert.deepStrictEqual(platform.describe().map(({ id }) => id), ['ecowitt-local-http']);
    }
  },
  {
    name: 'keeps nested adapter descriptions isolated from registrant and consumer mutations',
    run: () => {
      const compatibility = {
        summary: 'Local HTTP family',
        models: ['GW1200'],
        families: { gateway: ['GW'] }
      };
      const read = async () => null;
      Object.defineProperty(read, 'adapterDescriptor', {
        value: {
          id: 'ecowitt-local-http',
          aliases: ['ecowitt-gw1200'],
          label: 'Ecowitt-compatible LAN gateway',
          compatibility,
          capabilities: ['temperature']
        }
      });
      const platform = createSensorPlatform({ adapters: [{ id: 'ecowitt-gw1200', read }] });
      const firstDescription = platform.describe()[0];

      compatibility.models.push('external mutation');
      compatibility.families.gateway.push('external family');
      firstDescription.compatibility.models.push('consumer mutation');
      firstDescription.compatibility.families.gateway.push('consumer family');

      const secondDescription = platform.describe()[0];
      assert.deepStrictEqual(secondDescription.compatibility, {
        summary: 'Local HTTP family',
        models: ['GW1200'],
        families: { gateway: ['GW'] }
      });
      assert.strictEqual('read' in secondDescription, false);
    }
  },
  {
    name: 'migrates configured flat Ecowitt settings into one active device profile',
    run: () => {
      const settings = normalizeEnvironmentSettings({
        enabled: true,
        baseUrl: 'http://gateway.local/',
        pollIntervalMs: 45_000,
        timeoutMs: 2_500,
        units: { temperature: 'F' }
      });

      assert.deepStrictEqual(settings.devices, [{
        id: 'local-environment',
        name: 'Local environment',
        adapterId: 'ecowitt-local-http',
        baseUrl: 'http://gateway.local',
        pollIntervalMs: 45_000,
        timeoutMs: 2_500
      }]);
      assert.strictEqual(settings.activeDeviceId, 'local-environment');
      assert.strictEqual(settings.units.temperature, 'F');
    }
  },
  {
    name: 'retains saved devices while selecting, removing, and projecting one active source',
    run: () => {
      const initial = normalizeEnvironmentSettings({ devices: [], units: { temperature: 'C' } });
      const first = {
        id: createDeviceId('Living room', initial.devices),
        name: 'Living room',
        adapterId: 'ecowitt-local-http',
        baseUrl: 'http://living-room.local',
        pollIntervalMs: 60_000,
        timeoutMs: 3_000
      };
      const withFirst = upsertDevice(initial, first);
      const second = {
        ...first,
        id: createDeviceId('Living room', withFirst.devices),
        name: 'Office',
        baseUrl: 'http://office.local'
      };
      const selected = selectDevice(upsertDevice(withFirst, second), second.id);
      const projected = projectLegacySettings(selected);

      assert.deepStrictEqual(selected.devices.map(({ id }) => id), ['living-room', 'living-room-1']);
      assert.strictEqual(projected.enabled, true);
      assert.strictEqual(projected.baseUrl, 'http://office.local');
      assert.strictEqual(projected.activeDeviceId, 'living-room-1');
      assert.deepStrictEqual(
        projectLegacySettings(selectDevice(selected, null)),
        { ...projected, enabled: false, baseUrl: 'http://living-room.local', activeDeviceId: null }
      );
      assert.strictEqual(removeDevice(selected, second.id).activeDeviceId, null);
    }
  },
  {
    name: 'accepts legacy settings updates without discarding the device catalog',
    run: () => {
      const current = normalizeEnvironmentSettings({
        activeDeviceId: 'living-room',
        devices: [{
          id: 'living-room',
          name: 'Living room',
          adapterId: 'ecowitt-local-http',
          baseUrl: 'http://old.local',
          pollIntervalMs: 60_000,
          timeoutMs: 3_000
        }]
      });
      const updated = decodeEnvironmentSettings(current, {
        enabled: true,
        baseUrl: 'http://new.local',
        units: { pressure: 'inHg' }
      });

      assert.strictEqual(updated.devices.length, 1);
      assert.strictEqual(updated.devices[0].baseUrl, 'http://new.local');
      assert.strictEqual(updated.activeDeviceId, 'living-room');
      assert.strictEqual(updated.units.pressure, 'inHg');
    }
  },
  {
    name: 'validates every saved profile through its registered adapter',
    run: () => {
      const calls = [];
      const settings = normalizeEnvironmentSettings({
        devices: [{
          id: 'office',
          name: 'Office',
          adapterId: 'ecowitt-local-http',
          baseUrl: '',
          pollIntervalMs: 60_000,
          timeoutMs: 3_000
        }]
      });
      const result = validateEnvironmentSettings(settings, {
        adapterIds: ['ecowitt-local-http'],
        validateDevice: (adapterId, deviceSettings) => {
          calls.push([adapterId, deviceSettings]);
          return { valid: false, error: 'A gateway URL is required.' };
        }
      });

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Office: A gateway URL is required.');
      assert.strictEqual(calls[0][0], 'ecowitt-local-http');
      assert.strictEqual(calls[0][1].enabled, true);
    }
  }
];

async function run() {
  let passed = 0;

  for (const test of tests) {
    try {
      await test.run();
      passed += 1;
      console.log(`  ✓ PASS: ${test.name}`);
    } catch (error) {
      console.error(`  ✗ FAIL: ${test.name}`);
      console.error(`    ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\nSensor adapter regressions: ${passed}/${tests.length} passed.`);
  if (passed !== tests.length) process.exitCode = 1;
}

run();
