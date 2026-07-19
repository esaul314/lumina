import { useCallback, useEffect, useState } from 'react';
import { Database, Download, RefreshCw, RadioTower, Thermometer } from 'lucide-react';
import {
  formatEnvironmentMetric,
  formatEnvironmentTimestamp,
  getEnvironmentStatus,
  convertPressure,
  convertTemperature
} from '../../state/environmentHistory';

const readJson = async (path) => {
  const response = await fetch(path);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Environment API unavailable (${response.status})`);
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || 'Environment request failed');
  return body;
};

function EnvironmentSettingsTab({ state, handleToggleWidget }) {
  const [environment, setEnvironment] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [environmentResponse, historyResponse] = await Promise.all([
        readJson('/api/environment'),
        readJson('/api/environment/history?limit=24')
      ]);
      setEnvironment(environmentResponse);
      setHistory(historyResponse.readings || []);
      setError(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const refreshTimer = setInterval(refresh, 60_000);
    return () => clearInterval(refreshTimer);
  }, [refresh]);

  const status = getEnvironmentStatus(environment);
  const indoor = environment?.indoor;
  const latest = history[0];
  const units = environment?.units || {};
  const metricCount = environment?.metrics && typeof environment.metrics === 'object'
    ? Object.keys(environment.metrics).length
    : 0;

  return (
    <>
      <div className="remote-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <span className="remote-section-title" style={{ display: 'block', marginBottom: '6px' }}>Local Sensor Bay</span>
            <div style={{ fontSize: '0.78rem', opacity: 0.55 }}>IoT-ready devices, normalized for Lumina</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: status.color, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
            <span className="status-dot" style={{ backgroundColor: status.color, boxShadow: `0 0 10px ${status.color}` }} />
            {status.label}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(251,146,60,0.14), rgba(56,189,248,0.08))', border: '1px solid rgba(251,146,60,0.16)' }}>
          <RadioTower size={24} style={{ color: '#fb923c' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Ecowitt GW1200</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.55 }}>Indoor gateway adapter · {environment?.source || 'ecowitt-gw1200'}</div>
          </div>
          <div className="switch-wrapper" onClick={() => handleToggleWidget('indoorEnvironment', state.widgets.indoorEnvironment)} title="Toggle the indoor reading on the TV">
            <span className={`switch-slider ${state.widgets.indoorEnvironment ? 'checked' : ''}`}></span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {[
            ['Temperature', formatEnvironmentMetric(convertTemperature(indoor?.temperatureC, units.temperature), `°${units.temperature || 'C'}`)],
            ['Humidity', formatEnvironmentMetric(indoor?.humidityPercent, '%')],
            ['Pressure', formatEnvironmentMetric(convertPressure(indoor?.pressureRelativeHpa, units.pressure), ` ${units.pressure || 'hPa'}`)]
          ].map(([label, value]) => (
            <div key={label} style={{ padding: '12px 8px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', opacity: 0.5 }}>{label}</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '4px' }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', opacity: 0.55 }}>
          <span>{environment?.stale ? 'Last known good reading' : 'Last reading'}</span>
          <span>{formatEnvironmentTimestamp(environment?.observedAt)}</span>
        </div>
        {error && <div style={{ color: '#fca5a5', fontSize: '0.78rem' }}>{error}</div>}
        {loading && <div style={{ fontSize: '0.78rem', opacity: 0.55 }}>Refreshing sensor readings…</div>}
      </div>

      <div className="remote-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="remote-section-title" style={{ display: 'block', marginBottom: '6px' }}>Sensor History</span>
            <div style={{ fontSize: '0.75rem', opacity: 0.55 }}><Database size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />{history.length} hourly snapshots available</div>
          </div>
          <button className="remote-btn" onClick={refresh} disabled={loading} style={{ width: 'auto', padding: '8px 12px', fontSize: '0.75rem' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>

        {latest && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', fontSize: '0.75rem' }}>
            <Thermometer size={16} style={{ color: '#fb923c' }} />
            <span style={{ flex: 1 }}>Latest stored snapshot</span>
            <strong>{formatEnvironmentMetric(convertTemperature(latest.indoor_temperature_c, units.temperature), `°${units.temperature || 'C'}`)}</strong>
            <span style={{ opacity: 0.5 }}>{formatEnvironmentTimestamp(latest.observed_at)}</span>
          </div>
        )}

        <a className="remote-btn" href="/api/environment/history/export?format=csv" download="lumina-environment-history.csv" style={{ textDecoration: 'none' }}>
          <Download size={15} /> Export CSV for Grafana
        </a>
        <div style={{ fontSize: '0.7rem', opacity: 0.42, lineHeight: 1.5 }}>
          Lumina keeps the newest reading for each hour in its local SQLite history. Outdoor weather is included when available.
        </div>
        <details style={{ fontSize: '0.72rem', opacity: 0.62 }}>
          <summary style={{ cursor: 'pointer' }}>Gateway metrics preserved ({metricCount} top-level blocks)</summary>
          <pre style={{ maxHeight: '220px', overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.65rem', marginTop: '10px', color: 'rgba(255,255,255,0.65)' }}>
            {JSON.stringify(environment?.metrics || {}, null, 2)}
          </pre>
        </details>
      </div>
    </>
  );
}

export default EnvironmentSettingsTab;
