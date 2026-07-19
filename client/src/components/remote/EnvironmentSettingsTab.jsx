import { useCallback, useEffect, useState } from 'react';
import { Database, Download, RefreshCw, RadioTower, Thermometer } from 'lucide-react';
import {
  formatEnvironmentMetric,
  formatEnvironmentTimestamp,
  getEnvironmentStatus,
  convertPressure,
  convertTemperature,
  parseEnvironmentSettingsJson
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
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [settingsJson, setSettingsJson] = useState('');
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [environmentResponse, historyResponse, settingsResponse] = await Promise.all([
        readJson('/api/environment'),
        readJson('/api/environment/history?limit=24'),
        readJson('/api/environment/settings')
      ]);
      setEnvironment(environmentResponse);
      setHistory(historyResponse.readings || []);
      setSettings(settingsResponse);
      setSettingsJson(JSON.stringify(settingsResponse, null, 2));
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

  useEffect(() => {
    if (settings) {
      setDraft({
        ...settings,
        units: { ...settings.units }
      });
      setSettingsJson(JSON.stringify(settings, null, 2));
    }
  }, [settings]);

  const updateDraft = (field, value) => setDraft(current => ({ ...current, [field]: value }));
  const updateUnit = (field, value) => setDraft(current => ({
    ...current,
    units: { ...current.units, [field]: value }
  }));
  const saveSettings = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      const response = await fetch('/api/environment/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          pollIntervalMs: Number(draft.pollIntervalMs),
          timeoutMs: Number(draft.timeoutMs)
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || 'Could not save gateway settings');
      setSettings(body.settings);
      setSaveMessage('Saved and applied.');
      await refresh();
    } catch (saveError) {
      setSaveMessage(saveError.message);
    } finally {
      setSaving(false);
    }
  };
  const applySettingsJson = () => {
    const result = parseEnvironmentSettingsJson(settingsJson);
    if (!result.valid) {
      setSaveMessage(result.error);
      return;
    }
    setDraft(current => ({
      ...current,
      ...result.value,
      units: { ...current.units, ...(result.value.units || {}) }
    }));
    setSaveMessage('JSON applied to the form. Review and save.');
  };

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
        <span className="remote-section-title" style={{ display: 'block', marginBottom: '0' }}>Gateway Configuration</span>
        <div style={{ fontSize: '0.75rem', opacity: 0.55, lineHeight: 1.5 }}>
          Configure the local Ecowitt gateway for this Lumina instance. These settings are stored in the gitignored <code>config.json</code>.
        </div>
        <div className="widget-toggle-item">
          <div className="toggle-info">
            <RadioTower size={18} style={{ color: '#fb923c' }} />
            <div>
              <div className="toggle-label">Enable Ecowitt polling</div>
              <div className="toggle-desc">Read the gateway on the configured interval</div>
            </div>
          </div>
          <div className="switch-wrapper" onClick={() => updateDraft('enabled', !draft.enabled)}>
            <span className={`switch-slider ${draft.enabled ? 'checked' : ''}`}></span>
          </div>
        </div>
        <label style={{ fontSize: '0.72rem', opacity: 0.65 }}>GATEWAY URL
          <input value={draft.baseUrl || ''} onChange={event => updateDraft('baseUrl', event.target.value)} placeholder="http://ecowitt.local" style={{ display: 'block', width: '100%', marginTop: '5px', boxSizing: 'border-box', padding: '10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
        </label>
        <label style={{ fontSize: '0.72rem', opacity: 0.65 }}>POLL INTERVAL (SECONDS)
          <input type="number" min="10" value={Math.round(Number(draft.pollIntervalMs || 60000) / 1000)} onChange={event => updateDraft('pollIntervalMs', Number(event.target.value) * 1000)} style={{ display: 'block', width: '100%', marginTop: '5px', boxSizing: 'border-box', padding: '10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[
            ['temperature', 'Temperature', ['C', 'F']],
            ['pressure', 'Pressure', ['hPa', 'inHg']],
            ['wind', 'Wind', ['km/h', 'm/s', 'mph']],
            ['rain', 'Rain', ['mm', 'in']],
            ['light', 'Light', ['lux', 'W/m²']]
          ].map(([key, label, options]) => (
            <label key={key} style={{ fontSize: '0.72rem', opacity: 0.65 }}>{label.toUpperCase()}
              <select value={draft.units?.[key] || options[0]} onChange={event => updateUnit(key, event.target.value)} style={{ display: 'block', width: '100%', marginTop: '5px', padding: '9px', background: '#17151d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}>
                {options.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          ))}
        </div>
        <button className="remote-btn" onClick={saveSettings} disabled={saving || !settings}>
          {saving ? 'Saving…' : 'Save Gateway Configuration'}
        </button>
        {saveMessage && <div style={{ fontSize: '0.75rem', color: saveMessage.includes('Saved') ? '#86efac' : '#fca5a5' }}>{saveMessage}</div>}
        <details>
          <summary style={{ cursor: 'pointer', fontSize: '0.75rem', opacity: 0.65 }}>Advanced: paste adapter JSON</summary>
          <div style={{ fontSize: '0.7rem', opacity: 0.5, lineHeight: 1.5, margin: '8px 0' }}>
            Useful for setup guides and future adapters. This imports configuration into the validated form; it does not execute code.
          </div>
          <textarea
            value={settingsJson}
            onChange={event => setSettingsJson(event.target.value)}
            spellCheck="false"
            rows={10}
            aria-label="Adapter configuration JSON"
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#dbeafe', fontFamily: 'monospace', fontSize: '0.7rem', outline: 'none' }}
          />
          <button type="button" className="remote-btn" onClick={applySettingsJson} style={{ marginTop: '8px' }}>
            Apply JSON to Form
          </button>
        </details>
      </div>

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
