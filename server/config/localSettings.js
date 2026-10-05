// @ts-check

const fs = require('fs');

/** @typedef {Record<string, unknown>} LocalConfigRecord */
/** @typedef {LocalConfigRecord & { units?: LocalConfigRecord }} EcowittLocalConfig */
/** @typedef {LocalConfigRecord & { ecowitt?: EcowittLocalConfig; sensorHistory?: LocalConfigRecord }} LocalConfig */

/**
 * Merge the supported local settings sections without mutating either input.
 * Ecowitt units merge one level deeper; sensor-history settings remain a
 * shallow section merge so nested values keep their existing replacement semantics.
 *
 * @param {LocalConfig} current
 * @param {LocalConfig} patch
 * @returns {LocalConfig}
 */
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
