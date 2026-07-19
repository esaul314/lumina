// @ts-check

const freezeList = (values = []) => Object.freeze([...values]);

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
}) => Object.freeze({
  id,
  aliases: freezeList(aliases),
  label,
  description,
  protocol,
  transport,
  endpoint,
  compatibility,
  capabilities: freezeList(capabilities),
  read,
  start,
  stop,
  updateSettings
});

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
  aliases: [...aliases],
  label,
  description,
  protocol,
  transport,
  endpoint,
  compatibility,
  capabilities: [...capabilities]
});

function createSensorPlatform({ adapters = [], primaryAdapterId = adapters[0]?.id } = {}) {
  const registeredAdapters = adapters.map(createSensorAdapter);
  const canonicalAdapters = new Map(registeredAdapters.map(adapter => [adapter.id, adapter]));
  const adapterMap = new Map(registeredAdapters.flatMap(adapter => (
    [adapter.id, ...adapter.aliases].map(id => [id, adapter])
  )));

  const getAdapter = id => adapterMap.get(id) || null;
  const getPrimaryAdapter = () => getAdapter(primaryAdapterId);
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