// @ts-check

const { DatabaseSync } = require('node:sqlite');

const DEFAULT_LIMIT = 168;
const MAX_LIMIT = 10_000;
const SENSOR_SOURCE = 'ecowitt-gw1200';

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeTimestamp = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const hourKeyFor = (timestamp) => timestamp.slice(0, 13);

const normalizeSensorSnapshot = ({ environment, weather = null, observedAt } = {}) => {
  const timestamp = normalizeTimestamp(observedAt || environment?.observedAt);
  if (!timestamp) return null;

  const indoor = environment?.indoor || {};
  const outdoor = weather?.current || {};
  const location = weather?.location || {};

  return {
    hourKey: hourKeyFor(timestamp),
    observedAt: timestamp,
    source: environment?.source || SENSOR_SOURCE,
    device: 'GW1200',
    indoorTemperatureC: toFiniteNumber(indoor.temperatureC),
    indoorHumidityPercent: toFiniteNumber(indoor.humidityPercent),
    indoorPressureAbsoluteHpa: toFiniteNumber(indoor.pressureAbsoluteHpa),
    indoorPressureRelativeHpa: toFiniteNumber(indoor.pressureRelativeHpa),
    outdoorTemperatureC: toFiniteNumber(outdoor.temperature_2m),
    outdoorHumidityPercent: toFiniteNumber(outdoor.relative_humidity_2m),
    outdoorApparentTemperatureC: toFiniteNumber(outdoor.apparent_temperature),
    outdoorPrecipitationMm: toFiniteNumber(outdoor.precipitation),
    outdoorRainMm: toFiniteNumber(outdoor.rain),
    outdoorSnowfallMm: toFiniteNumber(outdoor.snowfall),
    outdoorWeatherCode: toFiniteNumber(outdoor.weather_code),
    outdoorWindSpeedKmh: toFiniteNumber(outdoor.wind_speed_10m),
    latitude: toFiniteNumber(location.lat),
    longitude: toFiniteNumber(location.lon),
    gatewayMetricsJson: JSON.stringify(environment?.metrics || {})
  };
};

const clampLimit = (value) => Math.min(
  MAX_LIMIT,
  Math.max(1, Number.parseInt(String(value ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
);

const clampInteger = (value, fallback, minimum, maximum) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(maximum, Math.max(minimum, Math.trunc(number)))
    : fallback;
};

const buildHistorySchema = () => `
  CREATE TABLE IF NOT EXISTS sensor_history (
    hour_key TEXT PRIMARY KEY,
    observed_at TEXT NOT NULL,
    source TEXT NOT NULL,
    device TEXT NOT NULL,
    indoor_temperature_c REAL,
    indoor_humidity_percent REAL,
    indoor_pressure_absolute_hpa REAL,
    indoor_pressure_relative_hpa REAL,
    outdoor_temperature_c REAL,
    outdoor_humidity_percent REAL,
    outdoor_apparent_temperature_c REAL,
    outdoor_precipitation_mm REAL,
    outdoor_rain_mm REAL,
    outdoor_snowfall_mm REAL,
    outdoor_weather_code INTEGER,
    outdoor_wind_speed_kmh REAL,
    latitude REAL,
    longitude REAL,
    gateway_metrics_json TEXT NOT NULL DEFAULT '{}'
  ) STRICT;
`;

const ensureHistoryColumn = (db) => {
  const columns = db.prepare('PRAGMA table_info(sensor_history)').all().map(({ name }) => name);
  if (!columns.includes('gateway_metrics_json')) {
    db.exec("ALTER TABLE sensor_history ADD COLUMN gateway_metrics_json TEXT NOT NULL DEFAULT '{}'");
  }
};

const columns = [
  'hour_key', 'observed_at', 'source', 'device', 'indoor_temperature_c',
  'indoor_humidity_percent', 'indoor_pressure_absolute_hpa',
  'indoor_pressure_relative_hpa', 'outdoor_temperature_c',
  'outdoor_humidity_percent', 'outdoor_apparent_temperature_c',
  'outdoor_precipitation_mm', 'outdoor_rain_mm', 'outdoor_snowfall_mm',
  'outdoor_weather_code', 'outdoor_wind_speed_kmh', 'latitude', 'longitude', 'gateway_metrics_json'
];

const toRowValues = (snapshot) => [
  snapshot.hourKey, snapshot.observedAt, snapshot.source, snapshot.device,
  snapshot.indoorTemperatureC, snapshot.indoorHumidityPercent,
  snapshot.indoorPressureAbsoluteHpa, snapshot.indoorPressureRelativeHpa,
  snapshot.outdoorTemperatureC, snapshot.outdoorHumidityPercent,
  snapshot.outdoorApparentTemperatureC, snapshot.outdoorPrecipitationMm,
  snapshot.outdoorRainMm, snapshot.outdoorSnowfallMm, snapshot.outdoorWeatherCode,
  snapshot.outdoorWindSpeedKmh, snapshot.latitude, snapshot.longitude, snapshot.gatewayMetricsJson
];

const toCsv = (rows) => {
  const escape = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns.join(','), ...rows.map(row => columns.map(column => escape(row[column])).join(','))].join('\n') + '\n';
};

function createSensorHistoryStore({ databasePath = ':memory:', database = null } = {}) {
  const db = database || new DatabaseSync(databasePath);
  db.exec(buildHistorySchema());
  ensureHistoryColumn(db);
  const upsert = db.prepare(`
    INSERT INTO sensor_history (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
    ON CONFLICT(hour_key) DO UPDATE SET ${columns.slice(1).map(column => `${column}=excluded.${column}`).join(', ')}
  `);
  const select = db.prepare(`SELECT ${columns.join(', ')} FROM sensor_history WHERE (? IS NULL OR observed_at >= ?) AND (? IS NULL OR observed_at <= ?) ORDER BY observed_at DESC LIMIT ?`);

  const record = (snapshotInput) => {
    const snapshot = normalizeSensorSnapshot(snapshotInput);
    if (!snapshot) return null;
    upsert.run(...toRowValues(snapshot));
    return snapshot;
  };

  const history = ({ from = null, to = null, limit = DEFAULT_LIMIT } = {}) => (
    select.all(from, from, to, to, clampLimit(limit)).map((row) => ({
      ...row,
      gateway_metrics: JSON.parse(row.gateway_metrics_json || '{}')
    }))
  );

  // Keep aggregation in SQLite so the API does not materialize the full history.
  const stats = ({ days = 7, dayStart = 7, dayEnd = 19 } = {}) => {
    const validDays = clampInteger(days, 7, 1, 90);
    const validStart = clampInteger(dayStart, 7, 0, 23);
    const validEnd = clampInteger(dayEnd, 19, 0, 23);

    const summarySql = 'SELECT ' +
      "CASE WHEN CAST(strftime('%H', observed_at, 'localtime') AS INTEGER) >= ? " +
      "AND CAST(strftime('%H', observed_at, 'localtime') AS INTEGER) < ? " +
      "THEN 'daytime' ELSE 'nighttime' END AS period, " +
      'COUNT(*) AS samples, ' +
      'ROUND(AVG(indoor_temperature_c), 2) AS avg_temp_c, ' +
      'ROUND(AVG(indoor_humidity_percent), 2) AS avg_humidity_pct ' +
      'FROM sensor_history ' +
      "WHERE observed_at >= datetime('now', '-' || ? || ' days') " +
      'GROUP BY period';

    const summaryRows = db.prepare(summarySql).all(validStart, validEnd, validDays);

    const summaryMap = Object.fromEntries(
      ['daytime', 'nighttime'].map((period) => {
        const row = summaryRows.find(({ period: currentPeriod }) => currentPeriod === period);
        return [period, row
          ? {
              avg_temp_c: row.avg_temp_c,
              avg_humidity_pct: row.avg_humidity_pct,
              samples: row.samples
            }
          : { avg_temp_c: null, avg_humidity_pct: null, samples: 0 }];
      })
    );

    const dailySql = 'SELECT ' +
      "date(observed_at, 'localtime') AS date, " +
      "ROUND(AVG(CASE WHEN CAST(strftime('%H', observed_at, 'localtime') AS INTEGER) >= ? AND CAST(strftime('%H', observed_at, 'localtime') AS INTEGER) < ? THEN indoor_temperature_c END), 2) AS day_temp_c, " +
      "ROUND(AVG(CASE WHEN NOT (CAST(strftime('%H', observed_at, 'localtime') AS INTEGER) >= ? AND CAST(strftime('%H', observed_at, 'localtime') AS INTEGER) < ?) THEN indoor_temperature_c END), 2) AS night_temp_c, " +
      "ROUND(AVG(CASE WHEN CAST(strftime('%H', observed_at, 'localtime') AS INTEGER) >= ? AND CAST(strftime('%H', observed_at, 'localtime') AS INTEGER) < ? THEN indoor_humidity_percent END), 2) AS day_humidity_pct, " +
      "ROUND(AVG(CASE WHEN NOT (CAST(strftime('%H', observed_at, 'localtime') AS INTEGER) >= ? AND CAST(strftime('%H', observed_at, 'localtime') AS INTEGER) < ?) THEN indoor_humidity_percent END), 2) AS night_humidity_pct " +
      'FROM sensor_history ' +
      "WHERE observed_at >= datetime('now', '-' || ? || ' days') " +
      'GROUP BY date ' +
      'ORDER BY date ASC';

    const dailyRows = db.prepare(dailySql).all(
      validStart, validEnd,
      validStart, validEnd,
      validStart, validEnd,
      validStart, validEnd,
      validDays
    ).map(row => ({
      ...row,
      observed_at: row.date + 'T12:00:00.000Z'
    }));

    return {
      days: validDays,
      day_start: validStart,
      day_end: validEnd,
      summary: summaryMap,
      daily: dailyRows
    };
  };

  return {
    close: () => { if (!database) db.close(); },
    history,
    record,
    stats,
    exportCsv: options => toCsv(history(options))
  };
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  SENSOR_SOURCE,
  buildHistorySchema,
  clampLimit,
  createSensorHistoryStore,
  normalizeSensorSnapshot,
  toCsv
};
