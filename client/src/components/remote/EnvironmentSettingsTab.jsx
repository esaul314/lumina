import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Database,
  Download,
  Pencil,
  Plus,
  Power,
  RadioTower,
  RefreshCw,
  Thermometer,
  Trash2,
  Tv2,
  X
} from 'lucide-react';
import {
  convertPressure,
  convertTemperature,
  createEnvironmentDevice,
  formatEnvironmentMetric,
  formatEnvironmentTimestamp,
  getActiveEnvironmentDevice,
  getEnvironmentStatus,
  normalizeEnvironmentSettingsDraft,
  parseEnvironmentSettingsJson,
  removeEnvironmentDevice,
  selectEnvironmentDevice,
  upsertEnvironmentDevice
} from '../../state/environmentHistory';

const readJson = async path => {
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

const adapterFor = (adapters, adapterId) => adapters.find(adapter => (
  adapter.id === adapterId || adapter.aliases?.includes(adapterId)
));

const SwitchControl = ({ checked, label, description, onChange }) => (
  <button
    type="button"
    className="environment-switch"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
  >
    <span className="environment-switch-copy">
      <span className="environment-switch-label">{label}</span>
      <span className="environment-switch-description">{description}</span>
    </span>
    <span className={`environment-switch-track ${checked ? 'checked' : ''}`} aria-hidden="true">
      <span className="environment-switch-thumb" />
    </span>
  </button>
);

const StatusBadge = ({ label, color, subtle = false }) => (
  <span
    className={`environment-status-badge ${subtle ? 'subtle' : ''}`}
    style={{ '--environment-status-color': color }}
  >
    <span className="status-dot" />
    {label}
  </span>
);

const Metric = ({ label, value }) => (
  <div className="environment-metric">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

function EnvironmentSettingsTab({ state, handleToggleWidget }) {
  const [environment, setEnvironment] = useState(null);
  const [history, setHistory] = useState([]);
  const [adapters, setAdapters] = useState([]);
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(null);
  const [deviceDraft, setDeviceDraft] = useState(null);
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [pendingRemovalId, setPendingRemovalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [settingsJson, setSettingsJson] = useState('');
  const [error, setError] = useState(null);

  const showDeviceEditor = useCallback((catalog, deviceId) => {
    const device = catalog.devices.find(({ id }) => id === deviceId) || null;
    setEditingDeviceId(device?.id || null);
    setDeviceDraft(device ? { ...device } : null);
    setPendingRemovalId(null);
  }, []);

  const applyServerSettings = useCallback((responseSettings, preferredDeviceId) => {
    const normalized = normalizeEnvironmentSettingsDraft(responseSettings);
    const selectedId = preferredDeviceId && normalized.devices.some(({ id }) => id === preferredDeviceId)
      ? preferredDeviceId
      : normalized.activeDeviceId || normalized.devices[0]?.id || null;
    setSettings(responseSettings);
    setDraft(normalized);
    setSettingsJson(JSON.stringify(responseSettings, null, 2));
    showDeviceEditor(normalized, selectedId);
  }, [showDeviceEditor]);

  const refreshReadings = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setRefreshing(true);
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
      if (!quiet) setRefreshing(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
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
      setAdapters(adaptersResponse.adapters || []);
      applyServerSettings(settingsResponse);
      setError(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [applyServerSettings]);

  useEffect(() => {
    refreshAll();
    const refreshTimer = setInterval(() => refreshReadings({ quiet: true }), 60_000);
    return () => clearInterval(refreshTimer);
  }, [refreshAll, refreshReadings]);

  const persistSettings = async (nextSettings, { successMessage, preferredDeviceId } = {}) => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/environment/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextSettings)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || 'Could not save sensor settings');
      applyServerSettings(body.settings, preferredDeviceId);
      setMessage({ tone: 'success', text: successMessage || 'Environment settings saved.' });
      await refreshReadings({ quiet: true });
      return true;
    } catch (saveError) {
      setMessage({ tone: 'error', text: saveError.message });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const beginAddDevice = () => {
    if (!draft) return;
    const device = createEnvironmentDevice(draft, {
      adapterId: adapters[0]?.id || 'ecowitt-local-http'
    });
    setDeviceDraft(device);
    setEditingDeviceId(device.id);
    setPendingRemovalId(null);
    setMessage(null);
  };

  const editDevice = device => {
    setDeviceDraft({ ...device });
    setEditingDeviceId(device.id);
    setPendingRemovalId(null);
    setMessage(null);
  };

  const updateDeviceDraft = (field, value) => setDeviceDraft(current => ({
    ...current,
    [field]: value
  }));

  const saveDevice = async event => {
    event.preventDefault();
    if (!draft || !deviceDraft) return;
    const exists = draft.devices.some(({ id }) => id === deviceDraft.id);
    const preparedDevice = isNewDevice
      ? createEnvironmentDevice(draft, deviceDraft)
      : deviceDraft;
    const device = {
      ...preparedDevice,
      name: deviceDraft.name.trim(),
      baseUrl: deviceDraft.baseUrl.trim(),
      pollIntervalMs: Number(deviceDraft.pollIntervalMs),
      timeoutMs: Number(deviceDraft.timeoutMs)
    };
    const withDevice = upsertEnvironmentDevice(draft, device);
    const nextSettings = exists ? withDevice : selectEnvironmentDevice(withDevice, device.id);
    await persistSettings(nextSettings, {
      successMessage: exists ? `${device.name} updated.` : `${device.name} added and selected.`,
      preferredDeviceId: device.id
    });
  };

  const activateDevice = async device => persistSettings(
    selectEnvironmentDevice(draft, device.id),
    { successMessage: `${device.name} is now the active source.`, preferredDeviceId: device.id }
  );

  const stopPolling = async () => persistSettings(
    selectEnvironmentDevice(draft, null),
    { successMessage: 'Local sensor polling stopped.', preferredDeviceId: editingDeviceId }
  );

  const confirmRemoveDevice = async device => {
    const nextSettings = removeEnvironmentDevice(draft, device.id);
    await persistSettings(nextSettings, {
      successMessage: `${device.name} removed. Stored history was kept.`,
      preferredDeviceId: nextSettings.activeDeviceId || nextSettings.devices[0]?.id
    });
  };

  const updateUnit = (field, value) => setDraft(current => ({
    ...current,
    units: { ...current.units, [field]: value }
  }));

  const applySettingsJson = () => {
    const result = parseEnvironmentSettingsJson(settingsJson);
    if (!result.valid) {
      setMessage({ tone: 'error', text: result.error });
      return;
    }
    const normalized = normalizeEnvironmentSettingsDraft(result.value);
    setDraft(normalized);
    showDeviceEditor(normalized, normalized.activeDeviceId || normalized.devices[0]?.id);
    setMessage({ tone: 'info', text: 'JSON applied locally. Review the changes, then save.' });
  };

  const status = getEnvironmentStatus(environment);
  const indoor = environment?.indoor;
  const latest = history[0];
  const units = environment?.units || draft?.units || {};
  const activeDevice = draft ? getActiveEnvironmentDevice(draft) : null;
  const activeAdapter = useMemo(() => (
    adapterFor(adapters, activeDevice?.adapterId)
    || adapterFor(adapters, environment?.source)
    || null
  ), [activeDevice?.adapterId, adapters, environment?.source]);
  const editingAdapter = adapterFor(adapters, deviceDraft?.adapterId);
  const compatibility = editingAdapter?.compatibility?.summary
    || 'Compatible devices must expose the selected adapter’s local protocol.';
  const metricCount = environment?.metrics && typeof environment.metrics === 'object'
    ? Object.keys(environment.metrics).length
    : 0;
  const isNewDevice = Boolean(deviceDraft) && !draft?.devices.some(({ id }) => id === deviceDraft.id);
  const selectedDevice = draft?.devices.find(({ id }) => id === editingDeviceId) || null;
  const tvVisible = Boolean(state.widgets?.indoorEnvironment);

  return (
    <main className="environment-admin" aria-labelledby="environment-page-title">
      <header className="environment-page-header">
        <div>
          <span className="environment-eyebrow">System</span>
          <h2 id="environment-page-title">Environment</h2>
          <p>Connect a local sensor source, choose what Lumina reads, and control how it appears.</p>
        </div>
        <button
          type="button"
          className="remote-btn environment-compact-action"
          onClick={() => refreshReadings()}
          disabled={refreshing || loading}
        >
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
          Refresh
        </button>
      </header>

      {error && <div className="environment-message error" role="alert">{error}</div>}
      {message && <div className={`environment-message ${message.tone}`} role="status">{message.text}</div>}

      <div className="environment-overview-grid">
        <section className="remote-card environment-summary-card" aria-labelledby="indoor-summary-title">
          <div className="environment-card-heading">
            <div>
              <span className="remote-section-title">Current conditions</span>
              <h3 id="indoor-summary-title">Indoor environment</h3>
            </div>
            <StatusBadge label={status.label} color={status.color} />
          </div>

          <div className="environment-metrics">
            <Metric
              label="Temperature"
              value={formatEnvironmentMetric(convertTemperature(indoor?.temperatureC, units.temperature), `°${units.temperature || 'C'}`)}
            />
            <Metric label="Humidity" value={formatEnvironmentMetric(indoor?.humidityPercent, '%')} />
            <Metric
              label="Pressure"
              value={formatEnvironmentMetric(convertPressure(indoor?.pressureRelativeHpa, units.pressure), ` ${units.pressure || 'hPa'}`)}
            />
          </div>

          <div className="environment-reading-meta">
            <span>{environment?.stale ? 'Last known good reading' : 'Last reading'}</span>
            <span>{formatEnvironmentTimestamp(environment?.observedAt)}</span>
          </div>
          {loading && <span className="environment-loading">Loading sensor state…</span>}
        </section>

        <section className="remote-card environment-presentation-card" aria-labelledby="tv-presentation-title">
          <div className="environment-card-heading">
            <div className="environment-heading-with-icon">
              <Tv2 size={20} />
              <div>
                <span className="remote-section-title">Presentation</span>
                <h3 id="tv-presentation-title">Living-room display</h3>
              </div>
            </div>
          </div>
          <SwitchControl
            checked={tvVisible}
            label="Show indoor readings on TV"
            description="This changes presentation only; it does not start or stop the sensor connection."
            onChange={() => handleToggleWidget('indoorEnvironment', tvVisible)}
          />
          <div className="environment-active-source">
            <RadioTower size={18} />
            <div>
              <span>Active data source</span>
              <strong>{activeDevice?.name || 'None selected'}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="remote-card environment-devices-card" aria-labelledby="sensor-devices-title">
        <div className="environment-card-heading environment-devices-heading">
          <div>
            <span className="remote-section-title">Connections</span>
            <h3 id="sensor-devices-title">Sensor devices</h3>
            <p>Save several compatible sources. Lumina polls one active device at a time.</p>
          </div>
          <button type="button" className="remote-btn environment-primary-action" onClick={beginAddDevice} disabled={!draft || saving}>
            <Plus size={16} /> Add device
          </button>
        </div>

        <div className="environment-device-manager">
          <div className="environment-device-list" aria-label="Saved sensor devices">
            {draft?.devices.length > 0 ? draft.devices.map(device => {
              const adapter = adapterFor(adapters, device.adapterId);
              const active = device.id === draft.activeDeviceId;
              const selected = device.id === editingDeviceId;
              return (
                <article key={device.id} className={`environment-device-row ${active ? 'active' : ''} ${selected ? 'selected' : ''}`}>
                  <button type="button" className="environment-device-main" onClick={() => editDevice(device)} aria-label={`Edit ${device.name}`}>
                    <span className="environment-device-icon"><RadioTower size={19} /></span>
                    <span className="environment-device-copy">
                      <strong>{device.name}</strong>
                      <span>{adapter?.label || device.adapterId}</span>
                      <span className="environment-device-address">{device.baseUrl}</span>
                    </span>
                  </button>
                  <div className="environment-device-actions">
                    <span className={`environment-device-state ${active ? 'active' : ''}`}>
                      {active ? 'Active' : 'Saved'}
                    </span>
                    {active ? (
                      <button type="button" className="environment-text-action" onClick={stopPolling} disabled={saving}>
                        <Power size={13} /> Stop polling
                      </button>
                    ) : (
                      <button type="button" className="environment-text-action" onClick={() => activateDevice(device)} disabled={saving}>
                        <Check size={13} /> Use device
                      </button>
                    )}
                  </div>
                </article>
              );
            }) : (
              <div className="environment-empty-state">
                <RadioTower size={28} />
                <strong>No sensor devices yet</strong>
                <span>Add a gateway or compatible local source to begin.</span>
                <button type="button" className="remote-btn" onClick={beginAddDevice} disabled={!draft}>
                  <Plus size={15} /> Add your first device
                </button>
              </div>
            )}
          </div>

          <div className="environment-device-detail">
            {deviceDraft ? (
              <form onSubmit={saveDevice} className="environment-device-form">
                <div className="environment-detail-heading">
                  <div>
                    <span className="environment-eyebrow">{isNewDevice ? 'New source' : 'Device settings'}</span>
                    <h4>{isNewDevice ? 'Add sensor device' : `Edit ${selectedDevice?.name || deviceDraft.name}`}</h4>
                  </div>
                  <button
                    type="button"
                    className="environment-icon-button"
                    aria-label="Close device editor"
                    onClick={() => showDeviceEditor(draft, draft.activeDeviceId || draft.devices[0]?.id)}
                  >
                    <X size={17} />
                  </button>
                </div>

                {isNewDevice && draft.devices.length > 0 && (
                  <p className="environment-editor-note">Adding this device makes it active. The current profile remains saved.</p>
                )}

                <label className="environment-field">
                  <span>Device name</span>
                  <input
                    required
                    maxLength="80"
                    value={deviceDraft.name}
                    onChange={event => updateDeviceDraft('name', event.target.value)}
                    placeholder="Living room"
                  />
                </label>

                <label className="environment-field">
                  <span>Connection type</span>
                  <select value={deviceDraft.adapterId} onChange={event => updateDeviceDraft('adapterId', event.target.value)}>
                    {adapters.map(adapter => <option key={adapter.id} value={adapter.id}>{adapter.label}</option>)}
                  </select>
                </label>

                <div className="environment-compatibility-note">
                  <RadioTower size={16} />
                  <div>
                    <strong>{editingAdapter?.protocol || 'Local sensor protocol'}</strong>
                    <span>{compatibility}</span>
                  </div>
                </div>

                <label className="environment-field">
                  <span>Gateway address</span>
                  <input
                    required
                    inputMode="url"
                    value={deviceDraft.baseUrl}
                    onChange={event => updateDeviceDraft('baseUrl', event.target.value)}
                    placeholder="http://gateway.local"
                  />
                  <small>Lumina adds {editingAdapter?.endpoint || '/get_livedata_info'} automatically.</small>
                </label>

                <div className="environment-field-grid">
                  <label className="environment-field">
                    <span>Poll every</span>
                    <div className="environment-input-with-unit">
                      <input
                        required
                        type="number"
                        min="10"
                        value={Math.round(Number(deviceDraft.pollIntervalMs || 60_000) / 1000)}
                        onChange={event => updateDeviceDraft('pollIntervalMs', Number(event.target.value) * 1000)}
                      />
                      <span>seconds</span>
                    </div>
                  </label>
                  <label className="environment-field">
                    <span>Request timeout</span>
                    <div className="environment-input-with-unit">
                      <input
                        required
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={Number(deviceDraft.timeoutMs || 3_000) / 1000}
                        onChange={event => updateDeviceDraft('timeoutMs', Number(event.target.value) * 1000)}
                      />
                      <span>seconds</span>
                    </div>
                  </label>
                </div>

                <div className="environment-form-actions">
                  {!isNewDevice && (
                    <button
                      type="button"
                      className="environment-danger-action"
                      onClick={() => setPendingRemovalId(deviceDraft.id)}
                      disabled={saving}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                  <button type="submit" className="remote-btn environment-primary-action" disabled={saving || !settings}>
                    {saving ? 'Saving…' : isNewDevice ? 'Add & use device' : 'Save device'}
                  </button>
                </div>

                {pendingRemovalId === deviceDraft.id && (
                  <div className="environment-remove-confirmation" role="alert">
                    <div>
                      <strong>Remove {deviceDraft.name}?</strong>
                      <span>Its stored history will be kept.</span>
                    </div>
                    <button type="button" onClick={() => setPendingRemovalId(null)}>Cancel</button>
                    <button type="button" className="danger" onClick={() => confirmRemoveDevice(deviceDraft)}>Remove</button>
                  </div>
                )}
              </form>
            ) : (
              <div className="environment-detail-placeholder">
                <Pencil size={24} />
                <strong>Select a device to edit</strong>
                <span>Or add a compatible source using the button above.</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="environment-secondary-grid">
        <section className="remote-card" aria-labelledby="environment-units-title">
          <div className="environment-card-heading">
            <div>
              <span className="remote-section-title">Preferences</span>
              <h3 id="environment-units-title">Display units</h3>
              <p>Presentation only; stored readings remain normalized.</p>
            </div>
          </div>
          <div className="environment-units-grid">
            {UNIT_FIELDS.map(([key, label, options]) => (
              <label key={key} className="environment-field">
                <span>{label}</span>
                <select value={draft?.units?.[key] || options[0]} onChange={event => updateUnit(key, event.target.value)}>
                  {options.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            ))}
          </div>
          <button
            type="button"
            className="remote-btn"
            onClick={() => persistSettings(draft, { successMessage: 'Display units saved.', preferredDeviceId: editingDeviceId })}
            disabled={saving || !draft}
          >
            Save display units
          </button>
        </section>

        <section className="remote-card" aria-labelledby="environment-history-title">
          <div className="environment-card-heading">
            <div>
              <span className="remote-section-title">Storage</span>
              <h3 id="environment-history-title">History & diagnostics</h3>
              <p><Database size={13} /> {history.length} hourly snapshots available</p>
            </div>
          </div>
          {latest && (
            <div className="environment-latest-snapshot">
              <Thermometer size={17} />
              <span>Latest stored snapshot</span>
              <strong>{formatEnvironmentMetric(convertTemperature(latest.indoor_temperature_c, units.temperature), `°${units.temperature || 'C'}`)}</strong>
              <small>{formatEnvironmentTimestamp(latest.observed_at)}</small>
            </div>
          )}
          <a className="remote-btn" href="/api/environment/history/export?format=csv" download="lumina-environment-history.csv">
            <Download size={15} /> Export CSV
          </a>
          <details className="environment-disclosure">
            <summary><ChevronDown size={14} /> Raw gateway payload <span>{metricCount} blocks</span></summary>
            <pre>{JSON.stringify(environment?.metrics || {}, null, 2)}</pre>
          </details>
          <details className="environment-disclosure">
            <summary><ChevronDown size={14} /> Advanced settings JSON</summary>
            <div className="environment-json-editor">
              <textarea
                value={settingsJson}
                onChange={event => setSettingsJson(event.target.value)}
                spellCheck="false"
                rows={10}
                aria-label="Environment settings JSON"
              />
              <div className="environment-form-actions">
                <button type="button" className="remote-btn" onClick={applySettingsJson}>Apply to form</button>
                <button
                  type="button"
                  className="remote-btn environment-primary-action"
                  onClick={() => persistSettings(draft, { successMessage: 'Advanced settings saved.', preferredDeviceId: editingDeviceId })}
                  disabled={saving || !draft}
                >
                  Save JSON changes
                </button>
              </div>
            </div>
          </details>
        </section>
      </div>

      {activeAdapter && (
        <footer className="environment-protocol-footnote">
          <RadioTower size={14} />
          <span>{activeAdapter.label} · {activeAdapter.protocol} · {activeAdapter.endpoint}</span>
        </footer>
      )}
    </main>
  );
}

export default EnvironmentSettingsTab;
