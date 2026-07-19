import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Database, Download, RadioTower, RefreshCw, Thermometer } from 'lucide-react';
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

const UNIT_FIELDS = [
  ['temperature', 'Temperature', ['C', 'F']],
  ['pressure', 'Pressure', ['hPa', 'inHg']],
  ['wind', 'Wind', ['km/h', 'm/s', 'mph']],
  ['rain', 'Rain', ['mm', 'in']],
  ['light', 'Light', ['lux', 'W/m²']]
];

const panelStyle = {
  padding: '14px',
  borderRadius: '14px',
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.07)'
};

const fieldStyle = {
  display: 'block',
  width: '100%',
  marginTop: '5px',
  boxSizing: 'border-box',
  padding: '10px',
  background: 'rgba(0,0,0,0.32)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#fff'
};

const Section = ({ title, summary, children, open = false }) => (
  <details open={open} style={panelStyle}>
    <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <ChevronDown size={15} style={{ opacity: 0.55 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{title}</div>
        {summary && <div style={{ fontSize: '0.7rem', opacity: 0.48, marginTop: '2px' }}>{summary}</div>}
      </div>
    </summary>
    <div style={{ display: 'grid', gap: '12px', marginTop: '14px' }}>{children}</div>
  </details>
);

function EnvironmentSettingsTab({ state, handleToggleWidget }) {
  const [environment, setEnvironment] = useState(null);
  const [history, setHistory] = useState([]);
  const [adapters, setAdapters] = useState([]);
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
      const [environmentResponse, historyResponse, settingsResponse, adaptersResponse] = await Promise.all([
        readJson('/api/environment'),
        readJson('/api/environment/history?limit=24'),
        readJson('/api/environment/settings'),
        readJson('/api/environment/adapters')
      ]);
      setEnvironment(environmentResponse);
      setHistory(historyResponse.readings || []);
      setSettings(settingsResponse);
      setAdapters(adaptersResponse.adapters || []);
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
    if (!settings) return;
    setDraft({ ...settings, units: { ...settings.units } });
    setSettingsJson(JSON.stringify(settings, null, 2));
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
      if (!response.ok) throw new Error(body?.error || 'Could not save sensor settings');
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
  const activeAdapter = useMemo(() => (
    adapters.find(adapter => adapter.id === environment?.source || adapter.aliases?.includes(environment?.source))
    || adapters[0]
    || {
      label: 'Ecowitt-compatible LAN gateway',
      description: 'Local environmental telemetry',
      protocol: 'Ecowitt LAN HTTP',
      endpoint: '/get_livedata_info',
      capabilities: ['temperature', 'humidity', 'pressure']
    }
  ), [adapters, environment?.source]);
  const compatibility = activeAdapter.compatibility?.summary
    || 'Compatible with gateways that expose Ecowitt’s generic local HTTP API; verified with GW1200.';

  return (
    <>
      <div className="remote-card" style={{ gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <span className="remote-section-title" style={{ display: 'block', marginBottom: '6px' }}>Local Sensors</span>
            <div style={{ fontSize: '0.78rem', opacity: 0.55 }}>One normalized environment feed, independent of gateway model</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: status.color, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
            <span className="status-dot" style={{ backgroundColor: status.color, boxShadow: `0 0 10px ${status.color}` }} />
            {status.label}
          </div>
        </div>

        <div style={{ ...panelStyle, background: 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(56,189,248,0.055))', borderColor: 'rgba(16,185,129,0.16)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <RadioTower size={23} style={{ color: '#fb923c' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 750 }}>{activeAdapter.label}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.52, marginTop: '2px' }}>{activeAdapter.protocol} · {activeAdapter.endpoint}</div>
            </div>
            <div className="switch-wrapper" onClick={() => handleToggleWidget('indoorEnvironment', state.widgets.indoorEnvironment)} title="Show indoor readings on the TV">
              <span className={`switch-slider ${state.widgets.indoorEnvironment ? 'checked' : ''}`}></span>
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', opacity: 0.52, lineHeight: 1.45, marginTop: '12px' }}>{compatibility}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
            {(activeAdapter.capabilities || []).map(capability => (
              <span key={capability} style={{ fontSize: '0.64rem', padding: '4px 7px', borderRadius: '999px', background: 'rgba(255,255,255,0.055)', opacity: 0.68 }}>
                {capability.replaceAll('-', ' ')}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {[
            ['Temperature', formatEnvironmentMetric(convertTemperature(indoor?.temperatureC, units.temperature), `°${units.temperature || 'C'}`)],
            ['Humidity', formatEnvironmentMetric(indoor?.humidityPercent, '%')],
            ['Pressure', formatEnvironmentMetric(convertPressure(indoor?.pressureRelativeHpa, units.pressure), ` ${units.pressure || 'hPa'}`)]
          ].map(([label, value]) => (
            <div key={label} style={{ padding: '12px 7px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', opacity: 0.46 }}>{label}</div>
              <div style={{ fontSize: '0.94rem', fontWeight: 750, marginTop: '4px' }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', opacity: 0.48 }}>
          <span>{environment?.stale ? 'Last known good reading' : 'Last reading'}</span>
          <span>{formatEnvironmentTimestamp(environment?.observedAt)}</span>
        </div>
        {error && <div style={{ color: '#fca5a5', fontSize: '0.76rem' }}>{error}</div>}
        {loading && <div style={{ fontSize: '0.76rem', opacity: 0.5 }}>Refreshing sensor readings…</div>}

        <Section title="Connection" summary="Gateway address, polling, and availability" open>
          <div className="widget-toggle-item" style={{ margin: 0 }}>
            <div className="toggle-info">
              <RadioTower size={18} style={{ color: '#fb923c' }} />
              <div>
                <div className="toggle-label">Enable local sensor polling</div>
                <div className="toggle-desc">Read the configured gateway on this interval</div>
              </div>
            </div>
            <div className="switch-wrapper" onClick={() => updateDraft('enabled', !draft.enabled)}>
              <span className={`switch-slider ${draft.enabled ? 'checked' : ''}`}></span>
            </div>
          </div>
          <label style={{ fontSize: '0.7rem', opacity: 0.65 }}>GATEWAY ADDRESS
            <input value={draft.baseUrl || ''} onChange={event => updateDraft('baseUrl', event.target.value)} placeholder="http://ecowitt.local" style={fieldStyle} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <label style={{ fontSize: '0.7rem', opacity: 0.65 }}>POLL EVERY (SECONDS)
              <input type="number" min="10" value={Math.round(Number(draft.pollIntervalMs || 60000) / 1000)} onChange={event => updateDraft('pollIntervalMs', Number(event.target.value) * 1000)} style={fieldStyle} />
            </label>
            <label style={{ fontSize: '0.7rem', opacity: 0.65 }}>TIMEOUT (SECONDS)
              <input type="number" min="0.5" step="0.5" value={Number(draft.timeoutMs || 3000) / 1000} onChange={event => updateDraft('timeoutMs', Number(event.target.value) * 1000)} style={fieldStyle} />
            </label>
          </div>
          <button className="remote-btn" onClick={saveSettings} disabled={saving || !settings}>
            {saving ? 'Saving…' : 'Save Sensor Source'}
          </button>
          {saveMessage && <div style={{ fontSize: '0.74rem', color: saveMessage.includes('Saved') ? '#86efac' : '#fca5a5' }}>{saveMessage}</div>}
        </Section>

        <Section title="Display units" summary="Presentation only; storage remains normalized">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {UNIT_FIELDS.map(([key, label, options]) => (
              <label key={key} style={{ fontSize: '0.7rem', opacity: 0.65 }}>{label.toUpperCase()}
                <select value={draft.units?.[key] || options[0]} onChange={event => updateUnit(key, event.target.value)} style={{ ...fieldStyle, padding: '9px' }}>
                  {options.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            ))}
          </div>
        </Section>

        <Section title="Advanced configuration" summary="Validated JSON import for adapter setup">
          <textarea value={settingsJson} onChange={event => setSettingsJson(event.target.value)} spellCheck="false" rows={9} aria-label="Adapter configuration JSON" style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.68rem', color: '#dbeafe' }} />
          <button type="button" className="remote-btn" onClick={applySettingsJson}>Apply JSON to Form</button>
        </Section>
      </div>

      <div className="remote-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="remote-section-title" style={{ display: 'block', marginBottom: '6px' }}>History & Diagnostics</span>
            <div style={{ fontSize: '0.74rem', opacity: 0.52 }}><Database size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />{history.length} hourly snapshots available</div>
          </div>
          <button className="remote-btn" onClick={refresh} disabled={loading} style={{ width: 'auto', padding: '8px 11px', fontSize: '0.72rem' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
        {latest && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', fontSize: '0.72rem' }}>
            <Thermometer size={16} style={{ color: '#fb923c' }} />
            <span style={{ flex: 1 }}>Latest stored snapshot</span>
            <strong>{formatEnvironmentMetric(convertTemperature(latest.indoor_temperature_c, units.temperature), `°${units.temperature || 'C'}`)}</strong>
            <span style={{ opacity: 0.45 }}>{formatEnvironmentTimestamp(latest.observed_at)}</span>
          </div>
        )}
        <a className="remote-btn" href="/api/environment/history/export?format=csv" download="lumina-environment-history.csv" style={{ textDecoration: 'none' }}>
          <Download size={15} /> Export CSV
        </a>
        <details style={{ fontSize: '0.7rem', opacity: 0.62 }}>
          <summary style={{ cursor: 'pointer' }}>Raw gateway payload ({metricCount} top-level blocks)</summary>
          <pre style={{ maxHeight: '220px', overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.64rem', marginTop: '10px', color: 'rgba(255,255,255,0.65)' }}>
            {JSON.stringify(environment?.metrics || {}, null, 2)}
          </pre>
        </details>
      </div>
    </>
  );
}

export default EnvironmentSettingsTab;