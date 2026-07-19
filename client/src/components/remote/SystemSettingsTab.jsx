import { 
  Clock, Sun, Sliders, Palette, Sparkles, Maximize, Layout, Moon, 
  CloudRain, MapPin, Trash2, RefreshCw, QrCode, Thermometer
} from 'lucide-react';
import { useState } from 'react';
import EnvironmentSettingsTab from './EnvironmentSettingsTab';

function GeneralSettingsTab({
  state,
  actions,
  connectionInfo,
  handleToggleWidget,
  manualCity,
  setManualCity,
  manualRegion,
  setManualRegion,
  manualCountry,
  setManualCountry,
  manualLat,
  setManualLat,
  manualLon,
  setManualLon,
  useapiToken,
  setUseapiToken,
  tumblrApiKey,
  setTumblrApiKey,
  recrawlStatus,
  setRecrawlStatus,
  recrawlMessage,
  visionAnalysisStatus,
  setVisionAnalysisStatus,
  visionAnalysisMessage,
  useapiStatus,
  tumblrApiStatus,
  recrawlCount,
  visionAnalysisCount,
  handleRecrawl,
  handleVisionAnalysis,
  handleSaveTumblrApiKey,
  handleSaveUseapiToken
}) {
  return (
    <>
      <div className="remote-card">
        <span className="remote-section-title">TV Widgets Switchboard</span>
        <div className="widget-toggle-list">
          <div className="widget-toggle-item">
            <div className="toggle-info">
              <Clock size={18} style={{ color: 'var(--accent-color)' }} />
              <div>
                <div className="toggle-label">Cinematic Clock</div>
                <div className="toggle-desc">Overlay current local time and date</div>
              </div>
            </div>
            <div 
              className="switch-wrapper"
              onClick={() => handleToggleWidget('clock', state.widgets.clock)}
            >
              <span className={`switch-slider ${state.widgets.clock ? 'checked' : ''}`}></span>
            </div>
          </div>

          <div className="widget-toggle-item">
            <div className="toggle-info">
              <Thermometer size={18} style={{ color: '#fb923c' }} />
              <div>
                <div className="toggle-label">Indoor Environment</div>
                <div className="toggle-desc">Quietly show temperature, humidity, and pressure</div>
              </div>
            </div>
            <div
              className="switch-wrapper"
              onClick={() => handleToggleWidget('indoorEnvironment', state.widgets.indoorEnvironment)}
            >
              <span className={`switch-slider ${state.widgets.indoorEnvironment ? 'checked' : ''}`}></span>
            </div>
          </div>

          <div className="widget-toggle-item">
            <div className="toggle-info">
              <Sun size={18} style={{ color: '#fbbf24' }} />
              <div>
                <div className="toggle-label">Live Weather Hub</div>
                <div className="toggle-desc">Show temperature and 3-day forecast</div>
              </div>
            </div>
            <div 
              className="switch-wrapper"
              onClick={() => handleToggleWidget('weather', state.widgets.weather)}
            >
              <span className={`switch-slider ${state.widgets.weather ? 'checked' : ''}`}></span>
            </div>
          </div>

          <div className="widget-toggle-item">
            <div className="toggle-info">
              <QrCode size={18} style={{ color: '#38bdf8' }} />
              <div>
                <div className="toggle-label">QR & IP Badge</div>
                <div className="toggle-desc">Show QR code and connection IP for remote</div>
              </div>
            </div>
            <div 
              className="switch-wrapper"
              onClick={() => handleToggleWidget('qrcode', state.widgets.qrcode)}
            >
              <span className={`switch-slider ${state.widgets.qrcode ? 'checked' : ''}`}></span>
            </div>
          </div>

          <div className="widget-toggle-item">
            <div className="toggle-info">
              <Sliders size={18} style={{ color: '#a855f7' }} />
              <div>
                <div className="toggle-label">Bokeh Particle Glow</div>
                <div className="toggle-desc">Floating glowing dust motes</div>
              </div>
            </div>
            <div 
              className="switch-wrapper"
              onClick={() => handleToggleWidget('particles', state.widgets.particles)}
            >
              <span className={`switch-slider ${state.widgets.particles ? 'checked' : ''}`}></span>
            </div>
          </div>

          <div className="widget-toggle-item">
            <div className="toggle-info">
              <Palette size={18} style={{ color: '#ec4899' }} />
              <div>
                <div className="toggle-label">Dynamic Backlight Aura</div>
                <div className="toggle-desc">Soft colors breathing on borders</div>
              </div>
            </div>
            <div 
              className="switch-wrapper"
              onClick={() => handleToggleWidget('auraglow', state.widgets.auraglow)}
            >
              <span className={`switch-slider ${state.widgets.auraglow ? 'checked' : ''}`}></span>
            </div>
          </div>

          <div className="widget-toggle-item">
            <div className="toggle-info">
              <Sparkles size={18} style={{ color: '#eab308' }} />
              <div>
                <div className="toggle-label">Cinematic Pan & Zoom</div>
                <div className="toggle-desc">Ken Burns motion effect</div>
              </div>
            </div>
            <div 
              className="switch-wrapper"
              onClick={() => handleToggleWidget('animations', state.widgets.animations)}
            >
              <span className={`switch-slider ${state.widgets.animations ? 'checked' : ''}`}></span>
            </div>
          </div>
        </div>
      </div>

      <div className="remote-card">
        <span className="remote-section-title">Display Layout & Scaling</span>
        <div className="widget-toggle-list">
          <div className="widget-toggle-item">
            <div className="toggle-info">
              <Maximize size={18} style={{ color: '#3b82f6' }} />
              <div>
                <div className="toggle-label">Fit to Screen</div>
                <div className="toggle-desc">Fit full image without cropping (Contain)</div>
              </div>
            </div>
            <div 
              className="switch-wrapper"
              onClick={() => actions.changeScaleMode(state.scaleMode === 'contain' ? 'cover' : 'contain')}
            >
              <span className={`switch-slider ${state.scaleMode === 'contain' ? 'checked' : ''}`}></span>
            </div>
          </div>

          <div className="widget-toggle-item">
            <div className="toggle-info">
              <Layout size={18} style={{ color: '#10b981' }} />
              <div>
                <div className="toggle-label">Split Portrait Display</div>
                <div className="toggle-desc">Display two portrait images side-by-side</div>
              </div>
            </div>
            <div 
              className="switch-wrapper"
              onClick={() => actions.toggleSplitPortrait(!state.splitPortrait)}
            >
              <span className={`switch-slider ${state.splitPortrait ? 'checked' : ''}`}></span>
            </div>
          </div>

          {state.splitPortrait && (
            <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                <span style={{ opacity: 0.7 }}>Split Crop/Zoom Balance</span>
                <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{state.splitCropPercent !== undefined ? state.splitCropPercent : 50}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>Fit (0%)</span>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={state.splitCropPercent !== undefined ? state.splitCropPercent : 50}
                  onChange={(e) => actions.changeSplitCrop(parseInt(e.target.value, 10))}
                  style={{
                    flex: 1,
                    height: '6px',
                    borderRadius: '3px',
                    background: 'rgba(255,255,255,0.1)',
                    outline: 'none',
                    WebkitAppearance: 'none',
                    cursor: 'pointer'
                  }}
                  className="split-crop-slider"
                />
                <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>Fill (100%)</span>
              </div>
              <div style={{ fontSize: '0.7rem', opacity: 0.4, marginTop: '4px', textAlign: 'center' }}>
                Blends side pillarboxing and top/bottom cropping dynamically.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="remote-card">
        <span className="remote-section-title">Environmental Smart Alignment</span>
        <div className="widget-toggle-list">
          <div className="widget-toggle-item">
            <div className="toggle-info">
              <Moon size={18} style={{ color: '#818cf8' }} />
              <div>
                <div className="toggle-label">Align with Time of Day</div>
                <div className="toggle-desc">Show dark/night pictures during evening & night</div>
              </div>
            </div>
            <div 
              className="switch-wrapper"
              onClick={() => actions.toggleAlignTime(!state.alignTimeOfDay)}
            >
              <span className={`switch-slider ${state.alignTimeOfDay ? 'checked' : ''}`}></span>
            </div>
          </div>

          {state.alignTimeOfDay && (
            <div style={{ padding: '10px 14px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '12px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                <span style={{ opacity: 0.6 }}>Evening/Night Photo Ratio</span>
                <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{state.nightPercentage ?? 50}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                step="5"
                value={state.nightPercentage ?? 50} 
                onChange={(e) => actions.changeNightPercentage(parseInt(e.target.value, 10))}
                style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', outline: 'none', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
              />
              <div style={{ fontSize: '0.7rem', opacity: 0.4, marginTop: '6px', textAlign: 'center' }}>
                Determines what % of images served at night will be dark/night-themed
              </div>
            </div>
          )}

          <div className="widget-toggle-item">
            <div className="toggle-info">
              <CloudRain size={18} style={{ color: '#60a5fa' }} />
              <div>
                <div className="toggle-label">Atmospheric & News Sentiment Alignment</div>
                <div className="toggle-desc">Fuse local weather and global news sentiment to set the room mood</div>
              </div>
            </div>
            <div 
              className="switch-wrapper"
              onClick={() => actions.toggleAlignWeather(!state.alignWeather)}
            >
              <span className={`switch-slider ${state.alignWeather ? 'checked' : ''}`}></span>
            </div>
          </div>

          {state.alignWeather && (
            <div style={{ 
              padding: '12px 14px', 
              background: 'rgba(0, 0, 0, 0.25)', 
              borderRadius: '12px', 
              border: '1px solid rgba(255,255,255,0.05)', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px',
              marginTop: '4px',
              marginBottom: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                <span style={{ opacity: 0.6 }}>Local Physical Weather</span>
                <span style={{ fontWeight: 600, color: '#fbbf24' }}>
                  {state.physicalWeather ? `${state.physicalWeather.temp}°C, ${state.physicalWeather.condition}` : 'Loading...'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                <span style={{ opacity: 0.6 }}>Global News Sentiment</span>
                <span style={{ fontWeight: 600, color: state.newsSentiment?.score < -0.1 ? '#ef4444' : state.newsSentiment?.score > 0.1 ? '#10b981' : '#a855f7' }}>
                  {state.newsSentiment ? `${state.newsSentiment.label} (${state.newsSentiment.score})` : 'Calculating...'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                <span style={{ opacity: 0.6 }}>Active Wallpaper Mood</span>
                <span style={{ fontWeight: 600, color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {state.physicalWeather?.weatherMatch === 'Snowy' || state.physicalWeather?.weatherMatch === 'Rainy'
                    ? state.physicalWeather.weatherMatch
                    : state.newsSentiment?.weatherMatch || 'Cloudy'}
                </span>
              </div>
              <div style={{
                marginTop: '12px',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                paddingTop: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-color)', opacity: 0.9 }}>Vision API Settings</span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>Primary API URL</span>
                  <input
                    type="text"
                    placeholder="http://localhost:8100/v1"
                    value={state.visionConfig?.apiUrl || ''}
                    onChange={(e) => actions.updateVisionConfig({ ...state.visionConfig, apiUrl: e.target.value })}
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: '#fff',
                      padding: '6px 8px',
                      fontSize: '0.75rem',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                    <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>Model ID</span>
                    <input
                      type="text"
                      placeholder="qwen-vl"
                      value={state.visionConfig?.model || ''}
                      onChange={(e) => actions.updateVisionConfig({ ...state.visionConfig, model: e.target.value })}
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        color: '#fff',
                        padding: '6px 8px',
                        fontSize: '0.75rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                    <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>API Key (Optional)</span>
                    <input
                      type="password"
                      placeholder="None"
                      value={state.visionConfig?.apiKey || ''}
                      onChange={(e) => actions.updateVisionConfig({ ...state.visionConfig, apiKey: e.target.value })}
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        color: '#fff',
                        padding: '6px 8px',
                        fontSize: '0.75rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', paddingTop: '6px' }}>
                  <span style={{ opacity: 0.6 }}>Allow Fallback API</span>
                  <div
                    className='switch-wrapper'
                    style={{ transform: 'scale(0.85)', transformOrigin: 'right center' }}
                    onClick={() => actions.toggleAllowOpenAiFallback(!state.allowOpenAiFallback)}
                  >
                    <span className={`switch-slider ${state.allowOpenAiFallback ? 'checked' : ''}`}></span>
                  </div>
                </div>

                {state.allowOpenAiFallback && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    background: 'rgba(0,0,0,0.15)',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.03)',
                    marginTop: '4px'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>Fallback API URL</span>
                      <input
                        type="text"
                        placeholder="https://api.openai.com/v1"
                        value={state.visionConfig?.fallbackUrl || ''}
                        onChange={(e) => actions.updateVisionConfig({ ...state.visionConfig, fallbackUrl: e.target.value })}
                        style={{
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px',
                          color: '#fff',
                          padding: '4px 6px',
                          fontSize: '0.7rem',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                        <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>Fallback Model</span>
                        <input
                          type="text"
                          placeholder="gpt-4o"
                          value={state.visionConfig?.fallbackModel || ''}
                          onChange={(e) => actions.updateVisionConfig({ ...state.visionConfig, fallbackModel: e.target.value })}
                          style={{
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            color: '#fff',
                            padding: '4px 6px',
                            fontSize: '0.7rem',
                            outline: 'none'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                        <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>Fallback Key</span>
                        <input
                          type="password"
                          placeholder="sk-..."
                          value={state.visionConfig?.fallbackApiKey || ''}
                          onChange={(e) => actions.updateVisionConfig({ ...state.visionConfig, fallbackApiKey: e.target.value })}
                          style={{
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            color: '#fff',
                            padding: '4px 6px',
                            fontSize: '0.7rem',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="remote-card">
        <span className="remote-section-title">TV Geolocation Settings</span>
        <div className="widget-toggle-list">
          <div className="widget-toggle-item">
            <div className="toggle-info">
              <MapPin size={18} style={{ color: '#22d3ee' }} />
              <div>
                <div className="toggle-label">Auto IP Geolocation</div>
                <div className="toggle-desc">Automatically detect location using IP address</div>
              </div>
            </div>
            <div 
              className="switch-wrapper"
              onClick={() => actions.toggleAutoLocation(!state.autoLocation)}
            >
              <span className={`switch-slider ${state.autoLocation ? 'checked' : ''}`}></span>
            </div>
          </div>

          {!state.autoLocation && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-color)', opacity: 0.9 }}>Manual Coordinates Override</span>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>LATITUDE</label>
                  <input 
                    type="number" 
                    step="any"
                    placeholder="e.g. 45.45" 
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>LONGITUDE</label>
                  <input 
                    type="number" 
                    step="any"
                    placeholder="e.g. -73.56" 
                    value={manualLon}
                    onChange={(e) => setManualLon(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none' }} 
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>CITY NAME</label>
                <input 
                  type="text" 
                  placeholder="e.g. Verdun" 
                  value={manualCity}
                  onChange={(e) => setManualCity(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none' }} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>PROVINCE / STATE</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Quebec" 
                    value={manualRegion}
                    onChange={(e) => setManualRegion(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>COUNTRY</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Canada" 
                    value={manualCountry}
                    onChange={(e) => setManualCountry(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none' }} 
                  />
                </div>
              </div>

              <button 
                type="button" 
                className="remote-btn" 
                onClick={() => {
                  const latVal = parseFloat(manualLat);
                  const lonVal = parseFloat(manualLon);
                  if (isNaN(latVal) || latVal < -90 || latVal > 90) {
                    alert('Please enter a valid Latitude between -90 and 90.');
                    return;
                  }
                  if (isNaN(lonVal) || lonVal < -180 || lonVal > 180) {
                    alert('Please enter a valid Longitude between -180 and 180.');
                    return;
                  }
                  if (!manualCity.trim()) {
                    alert('Please enter a City name.');
                    return;
                  }
                  actions.updateManualLocation({
                    lat: latVal,
                    lon: lonVal,
                    city: manualCity.trim(),
                    regionName: manualRegion.trim(),
                    country: manualCountry.trim()
                  });
                }}
                style={{ background: 'var(--accent-color)', borderColor: 'var(--accent-color)', fontWeight: 600, marginTop: '4px' }}
              >
                Update Coordinates & Refresh Weather
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="remote-card">
        <span className="remote-section-title">Slideshow Cycle Interval</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {[
            { label: '15s', value: 15000 },
            { label: '1m', value: 60000 },
            { label: '2m', value: 120000 },
            { label: '5m', value: 300000 }
          ].map((opt) => {
            const isActive = (state.slideshowInterval || 120000) === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => actions.changeInterval(opt.value)}
                className="remote-btn"
                style={{
                  background: isActive ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.03)',
                  borderColor: isActive ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.08)',
                  padding: '8px 4px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.7)'
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', marginTop: '8px', textAlign: 'center' }}>
          Current: {state.slideshowInterval === 15000 ? '15 seconds (Demo mode)' : `${(state.slideshowInterval || 120000) / 60000} minutes`}
        </p>
      </div>

      <div className="remote-card">
        <span className="remote-section-title">Exclusion Keywords</span>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', marginTop: '-8px', lineHeight: 1.3 }}>
          Exclude matching wallpapers globally from slideshow feeds (e.g. &quot;anime&quot;, &quot;hentai&quot;, &quot;car&quot;).
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '12px 0' }}>
          {(state.excludedKeywords || []).length === 0 ? (
            <span style={{ fontSize: '0.75rem', opacity: 0.4, fontStyle: 'italic' }}>No active exclusion filters.</span>
          ) : (
            state.excludedKeywords.map((kw, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  fontSize: '0.75rem',
                  fontWeight: 500
                }}
              >
                {kw}
                <button
                  type="button"
                  onClick={() => {
                    const updated = state.excludedKeywords.filter(k => k !== kw);
                    actions.updateExcludedKeywords(updated);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </span>
            ))
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target;
            const kw = form.elements.exKey.value.trim();
            if (kw) {
              const current = state.excludedKeywords || [];
              if (!current.includes(kw)) {
                actions.updateExcludedKeywords([...current, kw]);
              }
              form.reset();
            }
          }}
          style={{ display: 'flex', gap: '8px' }}
        >
          <input
            type="text"
            name="exKey"
            placeholder="Add exclusion keyword..."
            style={{
              flex: 1,
              padding: '10px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            className="remote-btn"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
              fontWeight: 600,
              width: 'auto',
              padding: '0 16px'
            }}
          >
            Add
          </button>
        </form>
      </div>

      <div className="remote-card">
        <span className="remote-section-title">Vision Metadata Analysis</span>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', marginTop: '-8px', lineHeight: 1.3 }}>
          Re-run the background vision tagger across the curated library to refresh night, rain, sunny, cloudy, and snowy metadata through the REST job queue.
        </p>
        {visionAnalysisStatus === 'loading' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <RefreshCw size={18} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
              {visionAnalysisMessage || 'Analyzing photo metadata...'}
            </span>
          </div>
        ) : visionAnalysisStatus === 'success' ? (
          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10b981', padding: '12px', borderRadius: '12px', color: '#10b981', textAlign: 'center', fontSize: '0.85rem', fontWeight: 500 }}>
            ✓ Vision Analysis Completed! Tagged {visionAnalysisCount} photos.
          </div>
        ) : visionAnalysisStatus === 'error' ? (
          <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', padding: '12px', borderRadius: '12px', color: '#ef4444', textAlign: 'center', fontSize: '0.85rem', fontWeight: 500 }}>
            ✗ {visionAnalysisMessage || 'Vision analysis failed. Check the configured API endpoint.'}
          </div>
        ) : (
          <button
            onClick={async () => {
              setVisionAnalysisStatus('loading');
              await handleVisionAnalysis();
            }}
            className="remote-btn"
            style={{ background: 'rgba(34, 211, 238, 0.18)', borderColor: 'rgba(34, 211, 238, 0.35)', color: '#67e8f9', fontWeight: 600 }}
          >
            <RefreshCw size={16} /> Run Vision Analysis
          </button>
        )}
      </div>

      <div className="remote-card">
        <span className="remote-section-title">Database & Feed Management</span>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', marginTop: '-8px', lineHeight: 1.3 }}>
          Manually trigger the background crawler to query all active photography APIs (Reddit, Lexica, Unsplash, Wallhaven, NASA, Midjourney) and load fresh landscape images instantly.
        </p>
        {recrawlStatus === 'loading' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <RefreshCw size={18} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
              {recrawlMessage || 'Crawling web feeds & self-healing links...'}
            </span>
          </div>
        ) : recrawlStatus === 'success' ? (
          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10b981', padding: '12px', borderRadius: '12px', color: '#10b981', textAlign: 'center', fontSize: '0.85rem', fontWeight: 500 }}>
            ✓ Feeds Recrawled Successfully! Now showing {recrawlCount} images.
          </div>
        ) : recrawlStatus === 'error' ? (
          <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', padding: '12px', borderRadius: '12px', color: '#ef4444', textAlign: 'center', fontSize: '0.85rem', fontWeight: 500 }}>
            ✗ {recrawlMessage || 'Recrawl failed. Check server logs for API boundaries.'}
          </div>
        ) : (
          <button 
            onClick={async () => {
              setRecrawlStatus('loading');
              await handleRecrawl();
            }}
            className="remote-btn" 
            style={{ background: 'var(--accent-color)', borderColor: 'var(--accent-color)', fontWeight: 600 }}
          >
            <RefreshCw size={16} /> Force Dynamic Feed Recrawl
          </button>
        )}
      </div>

      <div className="remote-card">
        <span className="remote-section-title">Midjourney Integration</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Connection Status</span>
          <span style={{ 
            fontSize: '0.75rem', 
            fontWeight: 600, 
            color: state.hasUseApiToken ? '#10b981' : '#eab308', 
            background: state.hasUseApiToken ? 'rgba(16, 185, 129, 0.1)' : 'rgba(234, 179, 8, 0.1)', 
            padding: '2px 8px', 
            borderRadius: '12px',
            border: state.hasUseApiToken ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(234, 179, 8, 0.2)'
          }}>
            {state.hasUseApiToken ? '● Connected (UseAPI)' : '● Lexica Fallback Active'}
          </span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', marginTop: '-4px', lineHeight: 1.3 }}>
          Lumina crawls Midjourney AI landscape creations via UseAPI.net. Saving this token writes it to Lumina&apos;s shared `.env` file.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>USEAPI.NET BEARER TOKEN</label>
            <input 
              type="password" 
              placeholder={state.hasUseApiToken ? '••••••••••••••••••••' : 'Enter UseAPI.net Token'} 
              value={useapiToken}
              onChange={(e) => setUseapiToken(e.target.value)}
              style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none' }} 
            />
          </div>
          {useapiStatus === 'success' && (
            <div style={{ color: '#10b981', fontSize: '0.8rem', textAlign: 'center', fontWeight: 500 }}>
              ✓ Token saved and loaded successfully!
            </div>
          )}
          {useapiStatus === 'error' && (
            <div style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center', fontWeight: 500 }}>
              ✗ Failed to save token. Check filesystem permissions.
            </div>
          )}
          <button 
            onClick={async () => {
              if (!useapiToken.trim()) {
                alert('Please enter a valid token.');
                return;
              }
              await handleSaveUseapiToken();
            }}
            className="remote-btn" 
            style={{ background: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)', fontSize: '0.85rem' }}
          >
            Update Midjourney Token
          </button>
        </div>
      </div>

      <div className="remote-card">
        <span className="remote-section-title">Tumblr API Integration</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Connection Status</span>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: state.hasTumblrApiKey ? '#10b981' : '#eab308',
            background: state.hasTumblrApiKey ? 'rgba(16, 185, 129, 0.1)' : 'rgba(234, 179, 8, 0.1)',
            padding: '2px 8px',
            borderRadius: '12px',
            border: state.hasTumblrApiKey ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(234, 179, 8, 0.2)'
          }}>
            {state.hasTumblrApiKey ? '● Connected (Tumblr Tags)' : '● Blog-Only Mode'}
          </span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', marginTop: '-4px', lineHeight: 1.3 }}>
          Store your Tumblr API key in Lumina&apos;s shared `.env` file to enable authenticated Tumblr tag crawling.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>TUMBLR API KEY</label>
            <input
              type="password"
              placeholder={state.hasTumblrApiKey ? '••••••••••••••••••••' : 'Enter Tumblr API Key'}
              value={tumblrApiKey}
              onChange={(e) => setTumblrApiKey(e.target.value)}
              style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
            />
          </div>
          {tumblrApiStatus === 'success' && (
            <div style={{ color: '#10b981', fontSize: '0.8rem', textAlign: 'center', fontWeight: 500 }}>
              ✓ Tumblr API key saved to `.env`.
            </div>
          )}
          {tumblrApiStatus === 'error' && (
            <div style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center', fontWeight: 500 }}>
              ✗ Failed to save Tumblr API key. Check filesystem permissions.
            </div>
          )}
          <button
            onClick={async () => {
              if (!tumblrApiKey.trim()) {
                alert('Please enter a valid Tumblr API key.');
                return;
              }
              await handleSaveTumblrApiKey();
            }}
            className="remote-btn"
            style={{ background: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)', fontSize: '0.85rem' }}
          >
            Update Tumblr API Key
          </button>
        </div>
      </div>

      <div className="remote-card">
        <span className="remote-section-title">TV Connection Info</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ opacity: 0.5 }}>Local IP Address</span>
            <span style={{ fontFamily: 'monospace' }}>{connectionInfo.localIps[0] || 'localhost'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ opacity: 0.5 }}>Server Sync Port</span>
            <span>{connectionInfo.port}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ opacity: 0.5 }}>Inactivity Timeout</span>
            <span>10 Minutes (600s)</span>
          </div>
        </div>
      </div>
    </>
  );
}

function SystemSettingsTab(props) {
  const [section, setSection] = useState('general');
  const sections = [
    ['general', 'General'],
    ['environment', 'Environment']
  ];

  return (
    <>
      <div className={`system-subtabs ${section === 'environment' ? 'environment-width' : ''}`} role="tablist" aria-label="System settings sections">
        {sections.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={section === value}
            className={section === value ? 'active' : ''}
            onClick={() => setSection(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {section === 'general' ? <GeneralSettingsTab {...props} /> : <EnvironmentSettingsTab {...props} />}
    </>
  );
}

export default SystemSettingsTab;
