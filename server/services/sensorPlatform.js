// @ts-check

/**
 * @typedef {object} SensorAdapterDescriptor
 * @property {string} [id] canonical identifier supplied by the protocol adapter
 * @property {string[]} [aliases] additional source identifiers
 * @property {string} [label] human-readable adapter name
 * @property {string} [description] optional adapter summary
 * @property {string} [protocol] protocol name
 * @property {string} [transport] transport strategy
 * @property {string} [endpoint] protocol endpoint
 * @property {unknown} [compatibility] adapter-owned compatibility metadata
 * @property {string[]} [capabilities] normalized readings or retained payloads
 */

/** @typedef {{valid: true, settings: unknown} | {valid: false, error: string}} SensorSettingsResult */

/**
 * @typedef {(() => Promise<unknown>) & {adapterDescriptor?: SensorAdapterDescriptor}} SensorRead
 */

/** @typedef {() => void} SensorLifecycle */
/** @typedef {(settings: unknown) => SensorSettingsResult} SensorSettingsOperation */

/**
 * @typedef {object} SensorAdapterInput
 * @property {string} id
 * @property {string[]} [aliases]
 * @property {string} label
 * @property {string} [description]
 * @property {string} [protocol]
 * @property {string} [transport]
 * @property {string} [endpoint]
 * @property {unknown} [compatibility]
 * @property {string[]} [capabilities]
 * @property {SensorRead} read
 * @property {SensorLifecycle} [start]
 * @property {SensorLifecycle} [stop]
 * @property {SensorSettingsOperation} [validateSettings]
 * @property {SensorSettingsOperation} [updateSettings]
 */

/**
 * @typedef {object} RegisteredSensorAdapter
 * @property {string} id
 * @property {ReadonlyArray<string>} aliases
 * @property {string} label
 * @property {string} description
 * @property {string} protocol
 * @property {string} transport
 * @property {string} endpoint
 * @property {unknown} compatibility
 * @property {ReadonlyArray<string>} capabilities
 * @property {SensorRead} read
 * @property {SensorLifecycle} start
 * @property {SensorLifecycle} stop
 * @property {SensorSettingsOperation} validateSettings
 * @property {SensorSettingsOperation} updateSettings
 */

/**
 * @typedef {object} SensorAdapterSummary
 * @property {string} id
 * @property {string} label
 * @property {string[]} capabilities
 * @property {string[]} [aliases]
 * @property {string} [description]
 * @property {string} [protocol]
 * @property {string} [transport]
 * @property {string} [endpoint]
 * @property {unknown} [compatibility]
 */

/**
 * @typedef {object} SensorPlatformOptions
 * @property {SensorAdapterInput[]} [adapters]
 * @property {string} [primaryAdapterId]
 */

/**
 * @typedef {object} SensorPlatform
 * @property {() => SensorAdapterSummary[]} describe
 * @property {(id: string) => RegisteredSensorAdapter | null} getAdapter
 * @property {() => RegisteredSensorAdapter | null} getPrimaryAdapter
 * @property {(id: string) => Promise<unknown>} read
 * @property {() => Promise<unknown>} readPrimary
 * @property {() => void} start
 * @property {() => void} stop
 * @property {(id: string, settings: unknown) => SensorSettingsResult} validateSettings
 * @property {(id: string, settings: unknown) => SensorSettingsResult} updateSettings
 * @property {(settings: unknown) => SensorSettingsResult} updatePrimarySettings
 */

/** @param {string[]} [values=[]] @returns {ReadonlyArray<string>} */
const freezeList = (values = []) => Object.freeze([...new Set(values)]);

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isMetadataObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** @param {unknown} value @returns {unknown} */
const cloneMetadata = value => (
  Array.isArray(value)
    ? value.map(cloneMetadata)
    : isMetadataObject(value)
      ? Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, cloneMetadata(nested)]))
      : value
);

/** @param {unknown} value @returns {unknown} */
const freezeMetadata = value => (
  Array.isArray(value)
    ? Object.freeze(value.map(freezeMetadata))
    : isMetadataObject(value)
      ? Object.freeze(Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, freezeMetadata(nested)])))
      : value
);

/**
 * Resolve protocol metadata once and freeze the registered adapter boundary.
 * Metadata is copied so later descriptor or summary edits cannot mutate the registry.
 *
 * @param {SensorAdapterInput} input
 * @returns {RegisteredSensorAdapter}
 */
const createSensorAdapter = ({
  id,
  aliases = [],
  label,
  description = '',
  protocol = '',
  transport = '',
  endpoint = '',
  compatibility = null,
  capabilities = [],
  read,
  start = () => {},
  stop = () => {},
  validateSettings = () => ({ valid: false, error: 'This adapter is not configurable.' }),
  updateSettings = () => ({ valid: false, error: 'This adapter is not configurable.' })
}) => {
  /** @type {SensorAdapterDescriptor} */
  const descriptor = read?.adapterDescriptor || {};
  const canonicalId = descriptor.id || id;
  const resolvedAliases = [
    ...(descriptor.aliases || []),
    ...aliases,
    ...(id && id !== canonicalId ? [id] : [])
  ];

  return Object.freeze({
    id: canonicalId,
    aliases: freezeList(resolvedAliases),
    label: descriptor.label || label,
    description: descriptor.description || description,
    protocol: descriptor.protocol || protocol,
    transport: descriptor.transport || transport,
    endpoint: descriptor.endpoint || endpoint,
    compatibility: freezeMetadata(descriptor.compatibility ?? compatibility),
    capabilities: freezeList(descriptor.capabilities || capabilities),
    read,
    start,
    stop,
    validateSettings,
    updateSettings
  });
};

/** @param {RegisteredSensorAdapter} adapter @returns {SensorAdapterSummary} */
const describeAdapter = ({
  id,
  aliases,
  label,
  description,
  protocol,
  transport,
  endpoint,
  compatibility,
  capabilities
}) => ({
  id,
  label,
  capabilities: [...capabilities],
  ...(aliases.length > 0 ? { aliases: [...aliases] } : {}),
  ...(description ? { description } : {}),
  ...(protocol ? { protocol } : {}),
  ...(transport ? { transport } : {}),
  ...(endpoint ? { endpoint } : {}),
  ...(compatibility ? { compatibility: cloneMetadata(compatibility) } : {})
});

/**
 * Compose registered adapters behind one lookup and lifecycle interface.
 * Reads stay asynchronous effects; descriptor and summary construction remain projections.
 *
 * @param {SensorPlatformOptions} [options={}]
 * @returns {SensorPlatform}
 */
function createSensorPlatform({ adapters = [], primaryAdapterId = adapters[0]?.id } = {}) {
  const registeredAdapters = adapters.map(createSensorAdapter);
  const canonicalAdapters = new Map(registeredAdapters.map(adapter => [adapter.id, adapter]));
  const adapterMap = new Map(registeredAdapters.flatMap(adapter => (
    [adapter.id, ...adapter.aliases].map(id => [id, adapter])
  )));

  const getAdapter = id => adapterMap.get(id) || null;
  const getPrimaryAdapter = () => getAdapter(primaryAdapterId) || registeredAdapters[0] || null;
  const describe = () => [...canonicalAdapters.values()].map(describeAdapter);
  const read = id => {
    const adapter = getAdapter(id);
    return adapter ? adapter.read() : Promise.reject(new Error(`Unknown sensor adapter: ${id}`));
  };
  const readPrimary = () => {
    const adapter = getPrimaryAdapter();
    return adapter ? adapter.read() : Promise.reject(new Error('No primary sensor adapter is configured.'));
  };
  const start = () => [...canonicalAdapters.values()].forEach(adapter => adapter.start());
  const stop = () => [...canonicalAdapters.values()].forEach(adapter => adapter.stop());
  const validateSettings = (id, settings) => {
    const adapter = getAdapter(id);
    return adapter
      ? adapter.validateSettings(settings)
      : { valid: false, error: `Unknown sensor adapter: ${id}` };
  };
  const updateSettings = (id, settings) => {
    const adapter = getAdapter(id);
    return adapter
      ? adapter.updateSettings(settings)
      : { valid: false, error: `Unknown sensor adapter: ${id}` };
  };
  const updatePrimarySettings = settings => {
    const adapter = getPrimaryAdapter();
    return adapter
      ? adapter.updateSettings(settings)
      : { valid: false, error: 'No primary sensor adapter is configured.' };
  };

  return {
    describe,
    getAdapter,
    getPrimaryAdapter,
    read,
    readPrimary,
    start,
    stop,
    validateSettings,
    updateSettings,
    updatePrimarySettings
  };
}

module.exports = { createSensorAdapter, createSensorPlatform, describeAdapter };
