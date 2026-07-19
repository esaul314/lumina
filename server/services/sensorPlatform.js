// @ts-check

const createSensorAdapter = ({
  id,
  label,
  capabilities = [],
  read,
  start = () => {},
  stop = () => {},
  updateSettings = () => ({ valid: false, error: 'This adapter is not configurable.' })
}) => Object.freeze({
  id,
  label,
  capabilities: [...capabilities],
  read,
  start,
  stop,
  updateSettings
});

function createSensorPlatform({ adapters = [] } = {}) {
  const adapterMap = new Map(adapters.map(adapter => [adapter.id, createSensorAdapter(adapter)]));

  const getAdapter = id => adapterMap.get(id) || null;
  const describe = () => [...adapterMap.values()].map(({ id, label, capabilities }) => ({
    id,
    label,
    capabilities
  }));
  const read = id => {
    const adapter = getAdapter(id);
    return adapter ? adapter.read() : Promise.reject(new Error(`Unknown sensor adapter: ${id}`));
  };
  const start = () => adapters.forEach(adapter => getAdapter(adapter.id)?.start());
  const stop = () => adapters.forEach(adapter => getAdapter(adapter.id)?.stop());
  const updateSettings = (id, settings) => {
    const adapter = getAdapter(id);
    return adapter
      ? adapter.updateSettings(settings)
      : { valid: false, error: `Unknown sensor adapter: ${id}` };
  };

  return { describe, getAdapter, read, start, stop, updateSettings };
}

module.exports = { createSensorAdapter, createSensorPlatform };
