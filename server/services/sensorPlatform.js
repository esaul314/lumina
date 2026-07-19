// @ts-check

const freezeList = (values = []) => Object.freeze([...new Set(values)]);
const isMetadataObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const cloneMetadata = value => (
  Array.isArray(value)
    ? value.map(cloneMetadata)
    : isMetadataObject(value)
      ? Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, cloneMetadata(nested)]))
      : value
);
const freezeMetadata = value => (
  Array.isArray(value)
    ? Object.freeze(value.map(freezeMetadata))
    : isMetadataObject(value)
      ? Object.freeze(Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, freezeMetadata(nested)])))
      : value
);

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
  updateSettings = () => ({ valid: false, error: 'This adapter is not configurable.' })
}) => {
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
    updateSettings
  });
};

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
    updateSettings,
    updatePrimarySettings
  };
}

module.exports = { createSensorAdapter, createSensorPlatform, describeAdapter };
