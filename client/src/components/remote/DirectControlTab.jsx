import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';

function DirectControlTab({
  state,
  socket,
  activePhotoOrientation,
  secondPhoto,
  dragState,
  activePhotoCrop,
  previewContainerRef,
  swipeStatus,
  handleTouchStart,
  handleTouchEnd,
  handleDragStart,
  getSplitPreviewStyle,
  getSinglePreviewStyle,
  handlePhotoCropChange,
  triggerPrev,
  triggerNext,
  forceScreensaverToggle,
  themes,
  handleThemeChange
}) {
  return (
    <>
      <div className="remote-card">
        <span className="remote-section-title">TV Gesture Controller</span>
        <div 
          ref={previewContainerRef}
          className="swipe-pad"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            position: 'relative',
            backgroundColor: '#06050b',
            border: state.activePhoto ? '1px solid rgba(255,255,255,0.18)' : '2px dashed rgba(255,255,255,0.1)',
            color: '#fff',
            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            overflow: 'hidden'
          }}
        >
          {state.activePhoto && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 0,
              display: 'flex',
              backgroundColor: '#000'
            }}>
              {state.splitPortrait && activePhotoOrientation === 'portrait' && !state.activePhoto.preventPairing && secondPhoto ? (
                <div style={{ display: 'flex', width: '100%', height: '100%', gap: '6px', padding: '6px', boxSizing: 'border-box' }}>
                  <div 
                    onMouseDown={(e) => handleDragStart(e, state.activePhoto.url, false)}
                    onTouchStart={(e) => handleDragStart(e, state.activePhoto.url, false)}
                    style={{
                      flex: 1,
                      height: '100%',
                      cursor: dragState.isDragging && !dragState.isSecond ? 'grabbing' : 'ns-resize',
                      ...getSplitPreviewStyle(state.activePhoto.url, false)
                    }} 
                  />
                  <div 
                    onMouseDown={(e) => handleDragStart(e, secondPhoto.url, true)}
                    onTouchStart={(e) => handleDragStart(e, secondPhoto.url, true)}
                    style={{
                      flex: 1,
                      height: '100%',
                      cursor: dragState.isDragging && dragState.isSecond ? 'grabbing' : 'ns-resize',
                      ...getSplitPreviewStyle(secondPhoto.url, true)
                    }} 
                  />
                </div>
              ) : (
                <div 
                  onMouseDown={(e) => handleDragStart(e, state.activePhoto.url, false)}
                  onTouchStart={(e) => handleDragStart(e, state.activePhoto.url, false)}
                  style={{
                    width: '100%',
                    height: '100%',
                    cursor: dragState.isDragging ? 'grabbing' : 'ns-resize',
                    ...getSinglePreviewStyle(state.activePhoto.url)
                  }} 
                />
              )}
              {/* Subtle dark overlay for readability of gesture instructions */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.7))',
                zIndex: 1,
                pointerEvents: 'none'
              }} />
            </div>
          )}

          <div className="swipe-icon" style={{ position: 'relative', zIndex: 2, fontSize: '2.5rem', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))', marginTop: '-12px', pointerEvents: 'none' }}>
            {state.activePhoto ? '🖼️' : '✨'}
          </div>
          <p style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 20px 18px 20px', lineHeight: 1.4, fontWeight: 500, margin: 0, pointerEvents: 'none' }}>
            {swipeStatus}
          </p>
          {state.activePhoto && (
            <span style={{ 
              position: 'absolute',
              zIndex: 2,
              bottom: '12px',
              left: '16px',
              right: '16px',
              fontSize: '0.72rem',
              opacity: 0.65,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textAlign: 'center',
              pointerEvents: 'none'
            }}>
              TV PREVIEW: {state.activePhoto.title}
            </span>
          )}
        </div>

        {state.activePhoto && (
          <div style={{ marginTop: '16px', padding: '0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
              <span style={{ opacity: 0.6 }}>
                {state.splitPortrait && activePhotoOrientation === 'portrait' && secondPhoto 
                  ? 'Portrait Split Crop/Zoom' 
                  : 'Photo Crop/Zoom'}
              </span>
              <span style={{ color: 'var(--accent-color)' }}>{activePhotoCrop}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.72rem', opacity: 0.5 }}>Contain</span>
              <input
                type="range"
                min="0"
                max="100"
                value={activePhotoCrop}
                onChange={(e) => handlePhotoCropChange(e.target.value)}
                className="split-crop-slider"
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: '0.72rem', opacity: 0.5 }}>Cover</span>
            </div>
          </div>
        )}

        {state.activePhoto && activePhotoOrientation === 'portrait' && (
          <div style={{ marginTop: '16px', padding: '0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Allow Side-by-Side Pairing</div>
              <div style={{ fontSize: '0.72rem', opacity: 0.5 }}>Pair this portrait with another side-by-side</div>
            </div>
            <div 
              className="switch-wrapper"
              onClick={() => socket.emit('set-photo-prevent-pairing', {
                url: state.activePhoto.url,
                preventPairing: !state.activePhoto.preventPairing
              })}
              style={{ cursor: 'pointer' }}
            >
              <span className={`switch-slider ${!state.activePhoto.preventPairing ? 'checked' : ''}`}></span>
            </div>
          </div>
        )}

        {state.activePhoto && (
          <div style={{ marginTop: '16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
              <span style={{ opacity: 0.6 }}>Image Display Weight (Rating)</span>
              <span style={{ color: 'var(--accent-color)' }}>
                {state.activePhoto.rating === 1 ? '🛑 1 (Banned / Blocked)' :
                 state.activePhoto.rating === 10 ? '🌟 10 (Default / Max)' :
                 `📈 ${state.activePhoto.rating} (Weight: ${(state.activePhoto.rating || 10) / 10})`}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', width: '100%' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                const isCurrent = (state.activePhoto.rating || 10) === num;
                return (
                  <button
                    key={num}
                    onClick={() => socket.emit('rate-photo', { url: state.activePhoto.url, rating: num })}
                    className="remote-btn"
                    style={{
                      flex: 1,
                      height: '32px',
                      padding: 0,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isCurrent ? 'var(--accent-color)' : 'rgba(255,255,255,0.03)',
                      borderColor: isCurrent ? 'var(--accent-color)' : 'rgba(255,255,255,0.08)',
                      color: isCurrent ? '#fff' : 'rgba(255,255,255,0.7)',
                      cursor: 'pointer',
                      boxShadow: isCurrent ? '0 0 10px var(--accent-color)' : 'none'
                    }}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="manual-controls-row">
          <button className="remote-btn" onClick={triggerPrev}>
            <ChevronLeft size={18} /> Prev
          </button>
          <button 
            className="remote-btn" 
            onClick={forceScreensaverToggle}
            style={{ 
              background: state.screensaverActive ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)',
              borderColor: state.screensaverActive ? '#ef4444' : '#10b981'
            }}
          >
            {state.screensaverActive ? <EyeOff size={16} /> : <Eye size={16} />}
            {state.screensaverActive ? 'STOP SCENIC' : 'START SCENIC'}
          </button>
          <button className="remote-btn" onClick={triggerNext}>
            Next <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="remote-card">
        <span className="remote-section-title">TV Mood Aesthetics</span>
        <div className="theme-selector-grid">
          {themes.map((t, idx) => {
            const isActive = state.theme === t;
            return (
              <div 
                key={idx} 
                className={`mood-chip ${isActive ? 'active' : ''}`}
                onClick={() => handleThemeChange(t)}
              >
                <div className="mood-icon">
                  {t === 'Zen Retreat' && '🌿'}
                  {t === 'Cosmic Night' && '🪐'}
                  {t === 'Art Museum' && '🏛️'}
                  {t === 'Cyberpunk Rain' && '🌧️'}
                </div>
                <span>{t}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default DirectControlTab;
