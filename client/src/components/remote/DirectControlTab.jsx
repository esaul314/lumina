import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';

function DirectControlTab({
  state,
  actions,
  activePhotoOrientation,
  secondPhoto,
  dragState,
  activePhotoCrop,
  previewContainerRef,
  tvPreviewFrameStyle,
  tvPreviewMetaLabel,
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
  handleThemeChange,
  selectedPhotoSide,
  setSelectedPhotoSide,
  selectedPhoto,
  isSplitLayoutActive
}) {
  const handlePairingToggle = () => {
    if (!selectedPhoto) {
      return;
    }

    const nextPreventPairing = !selectedPhoto.preventPairing;
    actions.setPreventPairing(selectedPhoto.url, nextPreventPairing, {
      // Preserve the focused portrait as a single-image preview instead of
      // collapsing back to the other half of the split frame immediately.
      preserveActive: isSplitLayoutActive && nextPreventPairing
    });
  };

  return (
    <>
      <div className="remote-card">
        <span className="remote-section-title">TV Gesture Controller</span>
        {tvPreviewMetaLabel && (
          <div style={{
            fontSize: '0.72rem',
            color: 'rgba(255,255,255,0.4)',
            marginTop: '-14px',
            marginBottom: '4px',
            letterSpacing: '0.02em'
          }}>
            📺 {tvPreviewMetaLabel}
          </div>
        )}
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
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box'
              }}>
                <div style={{
                  ...tvPreviewFrameStyle,
                  position: 'relative',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  backgroundColor: '#000',
                  border: '1px solid rgba(255,255,255,0.2)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 18px 36px rgba(0,0,0,0.35)'
                }}>
                  {isSplitLayoutActive ? (
                    <div style={{ display: 'flex', width: '100%', height: '100%', gap: '6px', padding: '6px', boxSizing: 'border-box' }}>
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPhotoSide('left');
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleDragStart(e, state.activePhoto.url, false);
                          setSelectedPhotoSide('left');
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          handleDragStart(e, state.activePhoto.url, false);
                          setSelectedPhotoSide('left');
                        }}
                        onTouchEnd={(e) => {
                          e.stopPropagation();
                        }}
                        style={{
                          flex: 1,
                          height: '100%',
                          cursor: dragState.isDragging && !dragState.isSecond ? 'grabbing' : 'ns-resize',
                          boxSizing: 'border-box',
                          border: selectedPhotoSide === 'left' ? '2px solid var(--accent-color)' : '2px solid rgba(255,255,255,0.12)',
                          boxShadow: selectedPhotoSide === 'left' ? '0 0 10px var(--accent-color)' : 'none',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                          ...getSplitPreviewStyle(state.activePhoto.url, false)
                        }} 
                      />
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPhotoSide('right');
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleDragStart(e, secondPhoto.url, true);
                          setSelectedPhotoSide('right');
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          handleDragStart(e, secondPhoto.url, true);
                          setSelectedPhotoSide('right');
                        }}
                        onTouchEnd={(e) => {
                          e.stopPropagation();
                        }}
                        style={{
                          flex: 1,
                          height: '100%',
                          cursor: dragState.isDragging && dragState.isSecond ? 'grabbing' : 'ns-resize',
                          boxSizing: 'border-box',
                          border: selectedPhotoSide === 'right' ? '2px solid var(--accent-color)' : '2px solid rgba(255,255,255,0.12)',
                          boxShadow: selectedPhotoSide === 'right' ? '0 0 10px var(--accent-color)' : 'none',
                          transition: 'border-color 0.2s, box-shadow 0.2s',
                          ...getSplitPreviewStyle(secondPhoto.url, true)
                        }} 
                      />
                    </div>
                  ) : (
                    <div 
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleDragStart(e, state.activePhoto.url, false);
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        handleDragStart(e, state.activePhoto.url, false);
                      }}
                      onTouchEnd={(e) => {
                        e.stopPropagation();
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        cursor: dragState.isDragging ? 'grabbing' : 'ns-resize',
                        ...getSinglePreviewStyle(state.activePhoto.url)
                      }} 
                    />
                  )}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '14px',
                    pointerEvents: 'none'
                  }} />
                </div>
              </div>
            </div>
          )}

          {state.activePhoto && (
            <span style={{ 
              position: 'absolute',
              zIndex: 2,
              bottom: '12px',
              left: '16px',
              right: '16px',
              fontSize: '0.72rem',
              opacity: 0.85,
              textShadow: '0 1px 3px rgba(0,0,0,0.9)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textAlign: 'center',
              pointerEvents: 'none'
            }}>
              {isSplitLayoutActive && selectedPhoto
                ? `FOCUS: ${selectedPhoto.title} (${selectedPhotoSide === 'left' ? 'LEFT' : 'RIGHT'})`
                : `TV PREVIEW: ${state.activePhoto.title}`}
            </span>
          )}
        </div>

        <div style={{
          textAlign: 'center',
          fontSize: '0.78rem',
          color: 'rgba(255, 255, 255, 0.45)',
          marginTop: '10px',
          fontWeight: 500,
          letterSpacing: '0.02em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          <span>👆</span> {swipeStatus}
        </div>

        {selectedPhoto && (
          <div style={{ marginTop: '16px', padding: '0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
              <span style={{ opacity: 0.6 }}>
                {isSplitLayoutActive
                  ? `Zoom/Crop (${selectedPhotoSide === 'left' ? 'Left Photo' : 'Right Photo'})`
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

        {selectedPhoto && (selectedPhotoSide === 'right' || activePhotoOrientation === 'portrait') && (
          <div style={{ marginTop: '16px', padding: '0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                Allow Side-by-Side Pairing ({selectedPhotoSide === 'left' ? 'Left' : 'Right'})
              </div>
              <div style={{ fontSize: '0.72rem', opacity: 0.5 }}>Pair this portrait with another side-by-side</div>
            </div>
            <div 
              className="switch-wrapper"
              onClick={handlePairingToggle}
              style={{ cursor: 'pointer' }}
            >
              <span className={`switch-slider ${!selectedPhoto.preventPairing ? 'checked' : ''}`}></span>
            </div>
          </div>
        )}

        {selectedPhoto && (
          <div style={{ marginTop: '16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
              <span style={{ opacity: 0.6 }}>
                Image Display Weight ({selectedPhotoSide === 'left' ? 'Left Photo' : 'Right Photo'})
              </span>
              <span style={{ color: 'var(--accent-color)' }}>
                {selectedPhoto.rating === 1 ? '🛑 1 (Banned / Blocked)' :
                 (selectedPhoto.rating === 10 || selectedPhoto.rating === undefined) ? '🌟 10 (Default / Max)' :
                 `📈 ${selectedPhoto.rating} (Weight: ${selectedPhoto.rating / 10})`}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', width: '100%' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                const isCurrent = (selectedPhoto.rating || 10) === num;
                return (
                  <button
                    key={num}
                    onClick={() => actions.ratePhoto(selectedPhoto.url, num)}
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
        <details style={{ width: '100%' }}>
          <summary 
            className="remote-section-title"
            style={{ margin: 0 }}
          >
            <span>TV Mood Aesthetics</span>
            <span style={{ fontSize: '0.82rem', opacity: 0.5, fontWeight: 'normal', textTransform: 'none', letterSpacing: 'normal' }}>
              ({state.theme || 'Zen Retreat'}) ▾
            </span>
          </summary>
          <div className="theme-selector-grid" style={{ marginTop: '16px' }}>
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
        </details>
      </div>
    </>
  );
}

export default DirectControlTab;
