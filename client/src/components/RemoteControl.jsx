import React, { useState, useEffect } from 'react';
import { 
  Sun, Moon, Palette, Sliders, Smartphone, Image, RefreshCw, 
  ChevronLeft, ChevronRight, Check, Eye, EyeOff, HelpCircle, Sparkles,
  Clock, CloudRain
} from 'lucide-react';

function RemoteControl({ state, socket, connected, connectionInfo }) {
  const [touchStartX, setTouchStartX] = useState(0);
  const [swipeStatus, setSwipeStatus] = useState('Swipe left or right to change photo');
  const [activeTab, setActiveTab] = useState('controls'); // controls, settings, photos
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [isSavedEnv, setIsSavedEnv] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [keywordCategory, setKeywordCategory] = useState('Scenic Nature');
  const [newKeywordInput, setNewKeywordInput] = useState('');

  // Bounds check galleryIndex if the photos list changes
  useEffect(() => {
    if (state.photosList && galleryIndex >= state.photosList.length) {
      setGalleryIndex(0);
    }
  }, [state.photosList, galleryIndex]);

  // Swipe gesture handlers
  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX - touchEndX;

    // Minimum swipe threshold (50px)
    if (Math.abs(diffX) > 50) {
      if (diffX > 0) {
        // Swiped Left -> Next Photo
        socket.emit('next-photo');
        setSwipeStatus('Swiped Left: Next Photo');
      } else {
        // Swiped Right -> Prev Photo
        socket.emit('prev-photo');
        setSwipeStatus('Swiped Right: Previous Photo');
      }
      
      // Reset text after 2 seconds
      setTimeout(() => {
        setSwipeStatus('Swipe left or right to change photo');
      }, 2000);
    }
  };

  // Click manual pagination helpers
  const triggerNext = () => {
    socket.emit('next-photo');
    setSwipeStatus('Next Photo Triggered');
    setTimeout(() => setSwipeStatus('Swipe left or right to change photo'), 1500);
  };

  const triggerPrev = () => {
    socket.emit('prev-photo');
    setSwipeStatus('Previous Photo Triggered');
    setTimeout(() => setSwipeStatus('Swipe left or right to change photo'), 1500);
  };

  // Toggle Widget Helper
  const handleToggleWidget = (widgetName, currentValue) => {
    socket.emit('toggle-widget', { widgetName, visible: !currentValue });
  };

  // Change Theme Helper
  const handleThemeChange = (themeName) => {
    socket.emit('change-theme', themeName);
  };

  // Change Photo Category Helper
  const handleCategoryChange = (categoryName) => {
    const currentCats = state.currentCategory ? state.currentCategory.split(',') : [];
    let newCats;
    if (currentCats.includes(categoryName)) {
      if (currentCats.length > 1) {
        newCats = currentCats.filter(c => c !== categoryName);
      } else {
        newCats = currentCats;
      }
    } else {
      newCats = [...currentCats, categoryName];
    }
    socket.emit('change-category', newCats.join(','));
  };

  // Activate Screensaver Immediately
  const forceScreensaverToggle = () => {
    socket.emit('set-screensaver-active', !state.screensaverActive);
  };

  // Save Google Photos setup
  const saveGoogleCredentials = (e) => {
    e.preventDefault();
    if (googleClientId && googleClientSecret) {
      // Simulate environment saving for local OAuth flow
      setIsSavedEnv(true);
      alert('Google Photos Credentials successfully registered! (In local development server)');
    }
  };

  const categories = ['Scenic Nature', 'Cosmic Space', 'Abstract Art', 'Liminal Spaces', 'AI Creations'];
  const themes = ['Zen Retreat', 'Cosmic Night', 'Art Museum', 'Cyberpunk Rain'];

  return (
    <div className={`lumina-remote-container theme-${state.theme.toLowerCase().replace(' ', '-')}`}>
      {/* 1. Header Section */}
      <div className="remote-header">
        <h1>LUMINA LINK</h1>
        <div className="remote-status">
          <div className="status-dot" style={{ backgroundColor: connected ? '#10b981' : '#ef4444', boxShadow: connected ? '0 0 10px #10b981' : '0 0 10px #ef4444' }} />
          <span>{connected ? 'CONNECTED TO TV DASHBOARD' : 'SEARCHING FOR TV CLIENT...'}</span>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div style={{ display: 'flex', width: '100%', maxWidth: '480px', gap: '8px', marginBottom: '16px' }}>
        <button 
          onClick={() => setActiveTab('controls')}
          className="remote-btn" 
          style={{ 
            background: activeTab === 'controls' ? 'var(--accent-color)' : 'rgba(255,255,255,0.03)',
            borderColor: activeTab === 'controls' ? 'var(--accent-color)' : 'rgba(255,255,255,0.08)'
          }}
        >
          <Smartphone size={16} /> Direct Control
        </button>
        <button 
          onClick={() => setActiveTab('photos')}
          className="remote-btn" 
          style={{ 
            background: activeTab === 'photos' ? 'var(--accent-color)' : 'rgba(255,255,255,0.03)',
            borderColor: activeTab === 'photos' ? 'var(--accent-color)' : 'rgba(255,255,255,0.08)'
          }}
        >
          <Image size={16} /> Image Feeds
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className="remote-btn" 
          style={{ 
            background: activeTab === 'settings' ? 'var(--accent-color)' : 'rgba(255,255,255,0.03)',
            borderColor: activeTab === 'settings' ? 'var(--accent-color)' : 'rgba(255,255,255,0.08)'
          }}
        >
          <Sliders size={16} /> System
        </button>
      </div>

      {/* 3. Tab: Direct Control (Swipe pad, widget switches) */}
      {activeTab === 'controls' && (
        <>
          <div className="remote-card">
            <span className="remote-section-title">TV Gesture Controller</span>
            <div 
              className="swipe-pad"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              style={{
                position: 'relative',
                backgroundImage: state.activePhoto ? `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url(${state.activePhoto.url})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: state.activePhoto ? '1px solid rgba(255,255,255,0.18)' : '2px dashed rgba(255,255,255,0.1)',
                color: '#fff',
                textShadow: '0 2px 8px rgba(0,0,0,0.8)'
              }}
            >
              <div className="swipe-icon" style={{ fontSize: '2.5rem', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))', marginTop: '-12px' }}>
                {state.activePhoto ? '🖼️' : '✨'}
              </div>
              <p style={{ textAlign: 'center', padding: '0 20px 18px 20px', lineHeight: 1.4, fontWeight: 500, margin: 0 }}>
                {swipeStatus}
              </p>
              {state.activePhoto && (
                <span style={{ 
                  position: 'absolute',
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
                  textAlign: 'center'
                }}>
                  TV PREVIEW: {state.activePhoto.title}
                </span>
              )}
            </div>

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
      )}

      {/* 4. Tab: Image Feeds (Unsplash scenic list, Google photos guide) */}
      {activeTab === 'photos' && (
        <>
          <div className="remote-card">
            <span className="remote-section-title">Curated Scenic Categories</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {categories.map((cat, idx) => {
                const isActive = state.currentCategory ? state.currentCategory.split(',').includes(cat) : false;
                return (
                  <div 
                    key={idx}
                    onClick={() => handleCategoryChange(cat)}
                    className="remote-btn"
                    role="button"
                    style={{
                      background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                      borderColor: isActive ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.06)',
                      justifyContent: 'space-between',
                      padding: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '1.2rem' }}>
                        {cat === 'Scenic Nature' && '⛰️'}
                        {cat === 'Cosmic Space' && '✨'}
                        {cat === 'Abstract Art' && '🎨'}
                        {cat === 'Liminal Spaces' && '🚪'}
                        {cat === 'AI Creations' && '🤖'}
                      </span>
                      <span style={{ fontWeight: 500 }}>{cat} Feed</span>
                    </div>
                    {isActive && <Check size={18} style={{ color: 'var(--accent-color)' }} />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="remote-card">
            <span className="remote-section-title">Independent Rating Deck</span>
            {state.photosList && state.photosList.length > 0 ? (
              (() => {
                const photo = state.photosList[galleryIndex];
                if (!photo) return null;
                const photoRating = photo.rating !== undefined ? photo.rating : 10;
                
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Thumbnail Preview */}
                    <div 
                      style={{
                        height: '160px',
                        borderRadius: '12px',
                        backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.6)), url(${photo.url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        padding: '12px',
                        border: '1px solid rgba(255,255,255,0.18)'
                      }}
                    >
                      <span style={{ 
                        fontSize: '0.9rem', 
                        fontWeight: 600, 
                        color: '#fff',
                        textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {photo.title}
                      </span>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        opacity: 0.8, 
                        color: '#fff',
                        textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                      }}>
                        by {photo.author}
                      </span>
                    </div>

                    {/* Navigation Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <button 
                        className="remote-btn" 
                        onClick={() => setGalleryIndex((prev) => (prev - 1 + state.photosList.length) % state.photosList.length)}
                        style={{ flex: 1, padding: '8px 0', fontSize: '0.85rem' }}
                      >
                        <ChevronLeft size={16} /> Previous
                      </button>
                      <button 
                        className="remote-btn" 
                        onClick={() => socket.emit('set-active-photo', photo)}
                        style={{ flex: 1.2, padding: '8px 0', fontSize: '0.85rem', borderColor: 'var(--accent-color)', background: 'rgba(255,255,255,0.03)' }}
                      >
                        📺 Cast to TV
                      </button>
                      <button 
                        className="remote-btn" 
                        onClick={() => setGalleryIndex((prev) => (prev + 1) % state.photosList.length)}
                        style={{ flex: 1, padding: '8px 0', fontSize: '0.85rem' }}
                      >
                        Next <ChevronRight size={16} />
                      </button>
                    </div>

                    {/* Rating buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600 }}>
                        <span style={{ opacity: 0.6 }}>Set Weight (Rating)</span>
                        <span style={{ color: 'var(--accent-color)' }}>
                          {photoRating === 1 ? '🛑 1 (Banned)' :
                           photoRating === 10 ? '🌟 10 (Default / Max)' :
                           `📈 ${photoRating} (Weight: ${photoRating / 10})`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', width: '100%' }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                          const isCurrent = photoRating === num;
                          return (
                            <button
                              key={num}
                              onClick={() => socket.emit('rate-photo', { url: photo.url, rating: num })}
                              className="remote-btn"
                              style={{
                                flex: 1,
                                height: '28px',
                                padding: 0,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: isCurrent ? 'var(--accent-color)' : 'rgba(255,255,255,0.03)',
                                borderColor: isCurrent ? 'var(--accent-color)' : 'rgba(255,255,255,0.08)',
                                color: isCurrent ? '#fff' : 'rgba(255,255,255,0.7)',
                                cursor: 'pointer',
                                boxShadow: isCurrent ? '0 0 8px var(--accent-color)' : 'none'
                              }}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.72rem', opacity: 0.4, textAlign: 'center' }}>
                      Card {galleryIndex + 1} of {state.photosList.length} in active pool
                    </div>
                  </div>
                );
              })()
            ) : (
              <div style={{ opacity: 0.5, textAlign: 'center', padding: '20px' }}>
                No photos in active pool to display.
              </div>
            )}
          </div>

          <div className="remote-card">
            <span className="remote-section-title">Crawl Query Keyword Manager</span>
            
            {/* Category Dropdown Selector */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                SELECT SCENIC POOL
              </label>
              <select
                value={keywordCategory}
                onChange={(e) => setKeywordCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat} style={{ background: '#1c1917', color: '#fff' }}>
                    {cat} Pool
                  </option>
                ))}
              </select>
            </div>

            {/* List of pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {state.searchKeywords && state.searchKeywords[keywordCategory] && state.searchKeywords[keywordCategory].map((kw, kwIdx) => (
                <div
                  key={kwIdx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    color: 'rgba(255,255,255,0.85)'
                  }}
                >
                  <span>{kw}</span>
                  <span
                    onClick={() => {
                      const currentKws = state.searchKeywords[keywordCategory] || [];
                      const nextKws = currentKws.filter((_, idx) => idx !== kwIdx);
                      // Don't let them clear all keywords to keep query failsafe
                      if (nextKws.length === 0) {
                        alert('At least one query keyword is required to maintain crawl reliability.');
                        return;
                      }
                      socket.emit('update-keywords', { category: keywordCategory, keywords: nextKws });
                    }}
                    style={{
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      color: 'rgba(239, 68, 68, 0.8)',
                      padding: '0 2.5px',
                      fontSize: '0.9rem',
                      lineHeight: 1
                    }}
                  >
                    ×
                  </span>
                </div>
              ))}
            </div>

            {/* Inline add form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const text = newKeywordInput.trim();
                if (!text) return;
                const currentKws = state.searchKeywords[keywordCategory] || [];
                if (currentKws.includes(text)) {
                  alert('This query is already configured.');
                  return;
                }
                const nextKws = [...currentKws, text];
                socket.emit('update-keywords', { category: keywordCategory, keywords: nextKws });
                setNewKeywordInput('');
              }}
              style={{ display: 'flex', gap: '8px' }}
            >
              <input
                type="text"
                placeholder="Add custom search tag (e.g. alpine lakes)..."
                value={newKeywordInput}
                onChange={(e) => setNewKeywordInput(e.target.value)}
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
                  background: 'var(--accent-color)',
                  borderColor: 'var(--accent-color)',
                  fontWeight: 600,
                  padding: '0 16px'
                }}
              >
                Add
              </button>
            </form>
          </div>

          <div className="remote-card" style={{ background: 'rgba(66, 133, 244, 0.05)', borderColor: 'rgba(66, 133, 244, 0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '1.4rem' }}>🖼️</span>
              <span className="remote-section-title" style={{ color: '#4285f4', marginBottom: 0 }}>Google Photos Link</span>
            </div>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.4, color: 'rgba(255,255,255,0.7)', marginBottom: '16px' }}>
              Authorise Lumina to fetch albums directly from your private Google Photos archive.
            </p>
            {isSavedEnv ? (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '12px', borderRadius: '12px', color: '#10b981', textAlign: 'center', fontSize: '0.9rem' }}>
                ✓ Google Photos API Enabled. Redirecting to Google Login portal...
              </div>
            ) : (
              <form onSubmit={saveGoogleCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>CLIENT ID</label>
                  <input 
                    type="password" 
                    placeholder="Enter Google Client ID" 
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>CLIENT SECRET</label>
                  <input 
                    type="password" 
                    placeholder="Enter Google Client Secret" 
                    value={googleClientSecret}
                    onChange={(e) => setGoogleClientSecret(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }} 
                  />
                </div>
                <button type="submit" className="remote-btn" style={{ background: '#4285f4', borderColor: '#4285f4', fontWeight: 600 }}>
                  Link Google Photos Album
                </button>
              </form>
            )}
          </div>
        </>
      )}

      {/* 5. Tab: System (Toggles widgets, adjusts screensaver timings) */}
      {activeTab === 'settings' && (
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
                  onClick={() => socket.emit('toggle-align-time', !state.alignTimeOfDay)}
                >
                  <span className={`switch-slider ${state.alignTimeOfDay ? 'checked' : ''}`}></span>
                </div>
              </div>

              {state.alignTimeOfDay && (
                <div style={{ padding: '10px 14px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '12px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                    <span style={{ opacity: 0.6 }}>Evening/Night Photo Ratio</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{state.nightPercentage || 50}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5"
                    value={state.nightPercentage || 50} 
                    onChange={(e) => socket.emit('change-night-percentage', parseInt(e.target.value))}
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
                  onClick={() => socket.emit('toggle-align-weather', !state.alignWeather)}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ opacity: 0.6 }}>Active Wallpaper Mood</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {state.physicalWeather?.weatherMatch === 'Snowy' || state.physicalWeather?.weatherMatch === 'Rainy'
                        ? state.physicalWeather.weatherMatch
                        : state.newsSentiment?.weatherMatch || 'Cloudy'}
                    </span>
                  </div>
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
                    onClick={() => socket.emit('change-interval', opt.value)}
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
      )}

      {/* Footer Info */}
      <p style={{ fontSize: '0.75rem', opacity: 0.35, marginTop: '16px', letterSpacing: '0.05em' }}>
        LUMINA SYSTEM v1.0.0 • POWERED BY GOOGLE DEEPMIND
      </p>
    </div>
  );
}

export default RemoteControl;
