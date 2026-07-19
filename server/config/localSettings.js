// @ts-check

const fs = require('fs');

const mergeLocalConfig = (current, patch) => ({
  ...current,
  ...(patch.ecowitt ? {
    ecowitt: {
      ...current.ecowitt,
      ...patch.ecowitt,
      units: { ...current.ecowitt?.units, ...patch.ecowitt.units }
    }
  } : {}),
  ...(patch.sensorHistory ? {
    sensorHistory: { ...current.sensorHistory, ...patch.sensorHistory }
  } : {})
});

function saveLocalConfigPatch({ configPath, patch, fsImpl = fs }) {
  const current = fsImpl.existsSync(configPath)
    ? JSON.parse(fsImpl.readFileSync(configPath, 'utf8'))
    : {};
  const next = mergeLocalConfig(current, patch);
  const temporaryPath = `${configPath}.tmp`;
  fsImpl.writeFileSync(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  fsImpl.renameSync(temporaryPath, configPath);
  return next;
}

module.exports = { mergeLocalConfig, saveLocalConfigPatch };
