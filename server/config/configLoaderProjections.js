// @ts-check

/** @typedef {Record<string, unknown>} ConfigRecord */
/** @typedef {ConfigRecord & { units?: ConfigRecord }} EcowittConfig */
/** @typedef {ConfigRecord & { location?: ConfigRecord; ecowitt?: EcowittConfig; sensorHistory?: ConfigRecord }} AppConfig */
/** @typedef {{ config: AppConfig; ignoredSecretKeys: string[] }} ConfigProjection */

/** @type {ReadonlyArray<string>} */
const deprecatedSecretKeys = [
  'nasaApiKey',
  'useapiToken',
  'googleClientId',
  'googleClientSecret',
  'tumblrApiKey'
];

/**
 * Project user overrides over application defaults without mutating either
 * input. The location, Ecowitt units, and sensor-history sections preserve
 * their existing merge depths; secret-like legacy keys are omitted and
 * returned separately so the loader shell can warn about them.
 *
 * @param {AppConfig} defaults
 * @param {AppConfig} userConfig
 * @returns {ConfigProjection}
 */
const projectConfigOverrides = (defaults, userConfig) => {
  const ignoredSecretKeys = deprecatedSecretKeys.filter((key) => userConfig[key] !== undefined);
  const ignoredSecretKeySet = new Set(ignoredSecretKeys);
  /** @type {AppConfig} */
  const sanitizedConfig = Object.fromEntries(
    Object.entries(userConfig).filter(([key]) => !ignoredSecretKeySet.has(key))
  );

  return {
    config: {
      ...defaults,
      ...sanitizedConfig,
      location: {
        ...defaults.location,
        ...sanitizedConfig.location
      },
      ecowitt: {
        ...defaults.ecowitt,
        ...sanitizedConfig.ecowitt,
        units: {
          ...defaults.ecowitt?.units,
          ...sanitizedConfig.ecowitt?.units
        }
      },
      sensorHistory: {
        ...defaults.sensorHistory,
        ...sanitizedConfig.sensorHistory
      }
    },
    ignoredSecretKeys
  };
};

module.exports = { projectConfigOverrides };
