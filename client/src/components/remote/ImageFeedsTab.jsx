import { useState, useEffect, useRef } from 'react';
import { HelpCircle, RefreshCw, Trash2, Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

function ImageFeedsTab({
  state,
  socket,
  categories,
  handleCategoryChange,
  handleDeleteCategory,
  newCategoryName,
  setNewCategoryName,
  newCategoryKeyword,
  setNewCategoryKeyword,
  handleCreateCategory,
  galleryIndex,
  setGalleryIndex,
  imageStatus,
  setImageStatus,
  handleDragStart,
  dragState,
  getGalleryPhotoPreviewStyle,
  remoteOrientationCache,
  keywordCategory,
  setKeywordCategory,
  isSavedEnv,
  googleClientId,
  setGoogleClientId,
  googleClientSecret,
  setGoogleClientSecret,
  saveGoogleCredentials
}) {
  const [keywordInput, setKeywordInput] = useState('');
  const [localCrop, setLocalCrop] = useState(50);
  const cropTimeoutRef = useRef(null);

  const activeGalleryPhoto = state.photosList && state.photosList[galleryIndex] ? state.photosList[galleryIndex] : null;

  useEffect(() => {
    if (activeGalleryPhoto) {
      const defaultP = state.scaleMode === 'contain' ? 0 : 100;
      setLocalCrop(activeGalleryPhoto.cropPercent !== undefined ? activeGalleryPhoto.cropPercent : defaultP);
    }
  }, [activeGalleryPhoto?.url, activeGalleryPhoto?.cropPercent, state.scaleMode]);

  useEffect(() => {
    return () => {
      if (cropTimeoutRef.current) {
        clearTimeout(cropTimeoutRef.current);
      }
    };
  }, []);

  const activeChips = newCategoryKeyword ? newCategoryKeyword.split(',').map(s => s.trim()).filter(Boolean) : [];

  const handleAddChip = (text) => {
    const clean = text.trim();
    if (!clean) return;

    const words = clean.split(/[;,]/).map(w => w.trim()).filter(Boolean);
    const uniqueNewWords = words.filter(w => !activeChips.some(existing => existing.toLowerCase() === w.toLowerCase()));

    if (uniqueNewWords.length > 0) {
      const nextChips = [...activeChips, ...uniqueNewWords];
      setNewCategoryKeyword(nextChips.join(', '));
    }
  };

  const handleRemoveChip = (chipToRemove) => {
    const nextChips = activeChips.filter(c => c !== chipToRemove);
    setNewCategoryKeyword(nextChips.join(', '));
  };

  return (
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
                    {cat === 'Scenic Nature' ? '⛰️' :
                     cat === 'Cosmic Space' ? '✨' :
                     cat === 'Abstract Art' ? '🎨' :
                     cat === 'Liminal Spaces' ? '🚪' :
                     cat === 'AI Creations' ? '🤖' :
                     cat === 'Google Photos' ? '📸' : '🖼️'}
                  </span>
                  <span style={{ fontWeight: 500 }}>{cat} Feed</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isActive && <Check size={18} style={{ color: 'var(--accent-color)' }} />}
                  {cat !== 'Google Photos' && !['Scenic Nature', 'Cosmic Space', 'Abstract Art', 'Liminal Spaces', 'AI Creations'].includes(cat) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(cat);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255,255,255,0.4)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        borderRadius: '4px',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                      title={`Delete ${cat} Pool`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Create New Scenic Pool Form */}
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Create New Scenic Pool</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="text"
              placeholder="Pool Name (e.g. Classic Art)"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            
            {/* Tag/Chip Input for Pool Keywords */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '6px 12px',
              boxSizing: 'border-box'
            }}>
              {/* Chips container */}
              {activeChips.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {activeChips.map((chip, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem'
                      }}
                    >
                      <span>{chip}</span>
                      <span
                        onClick={() => handleRemoveChip(chip)}
                        style={{
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          color: 'rgba(255, 255, 255, 0.5)',
                          transition: 'color 0.2s',
                          fontSize: '0.9rem',
                          lineHeight: '1'
                        }}
                      >
                        ×
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Input field */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  placeholder={activeChips.length === 0 ? 'Keywords (e.g. oil painting, renaissance)' : 'Add more keywords...'}
                  value={keywordInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    // If they typed a comma or semicolon, add the chip immediately
                    if (val.endsWith(',') || val.endsWith(';')) {
                      handleAddChip(val.slice(0, -1));
                      setKeywordInput('');
                    } else {
                      setKeywordInput(val);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChip(keywordInput);
                      setKeywordInput('');
                    }
                  }}
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                    padding: '4px 0'
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    handleAddChip(keywordInput);
                    setKeywordInput('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-color)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px'
                  }}
                >
                  <Plus size={14} style={{ marginRight: '2px' }} /> ADD
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              if (keywordInput.trim()) {
                const clean = keywordInput.trim();
                const words = clean.split(/[;,]/).map(w => w.trim()).filter(Boolean);
                const uniqueNewWords = words.filter(w => !activeChips.some(existing => existing.toLowerCase() === w.toLowerCase()));
                const nextChips = [...activeChips, ...uniqueNewWords];
                const nextKeywordStr = nextChips.join(', ');
                
                const name = newCategoryName.trim();
                if (!name || nextChips.length === 0) {
                  alert('Please fill out both pool name and initial keyword(s).');
                  return;
                }
                const cleanName = name.replace(/,/g, ' ');
                if (cleanName.toLowerCase() === 'google photos') {
                  alert('Reserved name. Please choose a different name.');
                  return;
                }
                socket.emit('add-category', { category: cleanName, keyword: nextKeywordStr });
                setNewCategoryName('');
                setNewCategoryKeyword('');
                setKeywordInput('');
              } else {
                handleCreateCategory();
              }
            }}
            style={{
              background: 'var(--accent-color)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '0.85rem',
              fontWeight: '500',
              cursor: 'pointer',
              width: 'fit-content'
            }}
          >
            Create Pool
          </button>
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
                {/* Thumbnail Preview with loading and error boundaries */}
                {imageStatus === 'loading' && (
                  <div 
                    style={{
                      height: '160px',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--accent-color)', opacity: 0.8 }} />
                    <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>Preloading preview...</span>
                  </div>
                )}

                {imageStatus === 'failed' && (
                  <div 
                    style={{
                      height: '160px',
                      borderRadius: '12px',
                      background: 'rgba(239, 68, 68, 0.05)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '12px',
                      gap: '6px',
                      textAlign: 'center'
                    }}
                  >
                    <HelpCircle size={24} style={{ color: '#ef4444' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ef4444' }}>Preview Unavailable</span>
                    <span style={{ fontSize: '0.72rem', opacity: 0.6, lineHeight: 1.3 }}>
                      Source link is broken or restricted. Rate as 1 or use Ban & Next to skip.
                    </span>
                    
                    <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '6px', maxWidth: '240px' }}>
                      <button 
                        className="remote-btn" 
                        onClick={() => {
                          setImageStatus('loading');
                          const img = new window.Image();
                          img.onload = () => setImageStatus('loaded');
                          img.onerror = () => setImageStatus('failed');
                          img.src = photo.url;
                        }}
                        style={{ flex: 1, padding: '4px 0', fontSize: '0.75rem', background: 'rgba(255,255,255,0.02)' }}
                      >
                        Retry
                      </button>
                      <button 
                        className="remote-btn" 
                        onClick={() => {
                          socket.emit('rate-photo', { url: photo.url, rating: 1 });
                          setGalleryIndex((prev) => (prev + 1) % state.photosList.length);
                        }}
                        style={{ flex: 1.3, padding: '4px 0', fontSize: '0.75rem', borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.05)' }}
                      >
                        🛑 Ban & Next
                      </button>
                    </div>
                  </div>
                )}

                {imageStatus === 'loaded' && (
                  <div 
                    onMouseDown={(e) => handleDragStart(e, photo.url, false)}
                    onTouchStart={(e) => handleDragStart(e, photo.url, false)}
                    style={{
                      height: '160px',
                      borderRadius: '12px',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      padding: '12px',
                      border: '1px solid rgba(255,255,255,0.18)',
                      cursor: dragState.isDragging && dragState.photoUrl === photo.url ? 'grabbing' : 'ns-resize',
                      overflow: 'hidden',
                      ...getGalleryPhotoPreviewStyle(photo)
                    }}
                  >
                    <span style={{ 
                      fontSize: '0.9rem', 
                      fontWeight: 600, 
                      color: '#fff',
                      textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      zIndex: 2,
                      pointerEvents: 'none'
                    }}>
                      {photo.title}
                    </span>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      opacity: 0.8, 
                      color: '#fff',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                      zIndex: 2,
                      pointerEvents: 'none'
                    }}>
                      by {photo.author}
                    </span>
                  </div>
                )}

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

                {/* Photo Crop/Zoom range slider */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600 }}>
                    <span style={{ opacity: 0.6 }}>Photo Crop/Zoom (Rating Deck)</span>
                    <span style={{ color: 'var(--accent-color)' }}>
                      {localCrop}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.72rem', opacity: 0.5 }}>Contain</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={localCrop}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setLocalCrop(val);
                        if (cropTimeoutRef.current) {
                          clearTimeout(cropTimeoutRef.current);
                        }
                        cropTimeoutRef.current = setTimeout(() => {
                          socket.emit('set-photo-crop', {
                            url: photo.url,
                            cropPercent: val
                          });
                        }, 30); // 30ms debounce for real-time TV zoom
                      }}
                      className="split-crop-slider"
                      style={{
                        flex: 1,
                        height: '6px',
                        borderRadius: '3px',
                        background: 'rgba(255,255,255,0.1)',
                        outline: 'none',
                        WebkitAppearance: 'none',
                        cursor: 'pointer'
                      }}
                    />
                    <span style={{ fontSize: '0.72rem', opacity: 0.5 }}>Cover</span>
                  </div>
                </div>

                {/* Allow Side-by-Side Pairing toggle (slider) if photo is portrait */}
                {remoteOrientationCache.current[photo.url] === 'portrait' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Allow Side-by-Side Pairing</div>
                      <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>Pair this portrait with another side-by-side</div>
                    </div>
                    <div 
                      className="switch-wrapper"
                      onClick={() => socket.emit('set-photo-prevent-pairing', {
                        url: photo.url,
                        preventPairing: !photo.preventPairing
                      })}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className={`switch-slider ${!photo.preventPairing ? 'checked' : ''}`}></span>
                    </div>
                  </div>
                )}

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
        <span className="remote-section-title">Scenic Feed Source Manager</span>
        <p style={{ fontSize: '0.72rem', opacity: 0.5, lineHeight: '1.35', marginTop: '6px', marginBottom: '12px' }}>
          Configure search keywords, subreddits, Tumblr blogs, or Tumblr tags for each image source in this scenic pool.
        </p>
        
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
            {categories.filter(cat => cat !== 'Google Photos').map(cat => (
              <option key={cat} value={cat} style={{ background: '#1c1917', color: '#fff' }}>
                {cat} Pool
              </option>
            ))}
          </select>
        </div>

        {/* List of feed sources */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { key: 'unsplash', name: 'Unsplash Scenic', param: 'keywords', placeholder: 'Add keyword (e.g. mountains)...' },
            { key: 'wallhaven', name: 'Wallhaven SFW', param: 'keywords', placeholder: 'Add keyword (e.g. nature)...' },
            { key: 'metmuseum', name: 'Metropolitan Museum of Art', param: 'keywords', placeholder: 'Add keyword (e.g. oil painting)...' },
            { key: 'artic', name: 'Art Institute of Chicago', param: 'keywords', placeholder: 'Add keyword (e.g. impressionism)...' },
            { key: 'reddit', name: 'Reddit Subreddits', param: 'subreddits', placeholder: 'Add subreddit (e.g. EarthPorn)...' },
            { key: 'tumblr', name: 'Tumblr Public Blogs', param: 'blogs', placeholder: 'Add blog name (e.g. nasaimages)...' },
            { key: 'tumblrTags', name: 'Tumblr Tag Search', param: 'tags', placeholder: 'Add tag (e.g. landscape)...' },
            { key: 'nasaApod', name: 'NASA APOD', param: null },
            { key: 'bing', name: 'Bing Daily Wallpaper', param: null },
            { key: 'picsum', name: 'Lorem Picsum', param: null },
            { key: 'midjourney', name: 'Midjourney & Lexica AI', param: null }
          ].map(src => {
            const feedConfig = (state.feedConfigs && state.feedConfigs[keywordCategory]) || {};
            const srcConfig = feedConfig[src.key] || { enabled: false };
            const isEnabled = srcConfig.enabled;
            const hasParams = src.param !== null;
            const paramsList = hasParams ? (srcConfig[src.param] || []) : [];

            return (
              <div
                key={src.key}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: '12px',
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f5f5f7' }}>
                    {src.name}
                  </div>
                  <button
                    onClick={() => {
                      socket.emit('update-feed-config', {
                        category: keywordCategory,
                        source: src.key,
                        config: { enabled: !isEnabled }
                      });
                    }}
                    style={{
                      background: isEnabled ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '16px',
                      padding: '4px 12px',
                      fontSize: '0.72rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {isEnabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>

                {src.key === 'tumblrTags' && (
                  <div style={{ marginTop: '8px', fontSize: '0.72rem', lineHeight: 1.35, color: 'rgba(255,255,255,0.45)' }}>
                    Requires `TUMBLR_API_KEY` in the Lumina server environment. Without it, recrawls skip Tumblr tag lookups safely.
                  </div>
                )}

                {isEnabled && hasParams && (
                  <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                    {/* Param pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                      {paramsList.map((val, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            color: 'rgba(255,255,255,0.85)'
                          }}
                        >
                          <span>
                            {typeof val === 'string'
                              ? val
                              : `[${val.timeStart}-${val.timeEnd}] ${(Array.isArray(val.keywords) ? val.keywords : [val.keywords]).join(', ')}`
                            }
                          </span>
                          <span
                            onClick={() => {
                              const nextParams = paramsList.filter((_, pIdx) => pIdx !== idx);
                              socket.emit('update-feed-config', {
                                category: keywordCategory,
                                source: src.key,
                                config: { [src.param]: nextParams }
                              });
                            }}
                            style={{
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              color: 'rgba(239, 68, 68, 0.8)',
                              padding: '0 2px',
                              fontSize: '0.85rem'
                            }}
                          >
                            ×
                          </span>
                        </div>
                      ))}
                      {paramsList.length === 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                          No active parameters. Please add one below.
                        </div>
                      )}
                    </div>

                    {/* Inline Input to add parameter */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const inputVal = e.target.elements[src.key + '_input'].value.trim();
                        if (!inputVal) return;

                        let newVals = [];
                        const timeRangeRegex = /^\[([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]\]\s+(.+)$/;
                        const match = inputVal.match(timeRangeRegex);
                        if (match) {
                          const [, start, end, kwsStr] = match;
                          newVals = [{
                            timeStart: start,
                            timeEnd: end,
                            keywords: kwsStr.split(/[;,]/).map(kw => kw.trim()).filter(Boolean)
                          }];
                        } else {
                          // Regular parameters: split by comma/semicolon to allow multiple inputs
                          newVals = inputVal.split(/[;,]/).map(val => val.trim()).filter(Boolean);
                        }

                        // Filter out duplicates
                        const uniqueNewVals = newVals.filter(newVal => {
                          return !paramsList.some(item => {
                            if (typeof item === 'string' && typeof newVal === 'string') {
                              return item.toLowerCase() === newVal.toLowerCase();
                            }
                            if (item && typeof item === 'object' && newVal && typeof newVal === 'object') {
                              return item.timeStart === newVal.timeStart &&
                                     item.timeEnd === newVal.timeEnd &&
                                     JSON.stringify(item.keywords) === JSON.stringify(newVal.keywords);
                            }
                            return false;
                          });
                        });

                        if (uniqueNewVals.length === 0) {
                          alert('The entered parameter(s) already exist.');
                          return;
                        }

                        const nextParams = [...paramsList, ...uniqueNewVals];
                        socket.emit('update-feed-config', {
                          category: keywordCategory,
                          source: src.key,
                          config: { [src.param]: nextParams }
                        });
                        e.target.reset();
                      }}
                      style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
                    >
                      <input
                        type="text"
                        name={src.key + '_input'}
                        placeholder={src.placeholder}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          background: 'rgba(0,0,0,0.4)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '0.8rem',
                          outline: 'none',
                          minWidth: '150px'
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          color: '#fff',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '6px',
                          fontWeight: 600,
                          padding: '0 12px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          height: '31px'
                        }}
                      >
                        Add
                      </button>
                      {src.param === 'keywords' && (
                        <div style={{ width: '100%', fontSize: '0.65rem', opacity: 0.4, marginTop: '4px', lineHeight: '1.2' }}>
                          Hint: Add time-based keywords as <code>[06:00-12:00] morning, sunrise</code>
                        </div>
                      )}
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="remote-card" style={{ background: 'rgba(66, 133, 244, 0.05)', borderColor: 'rgba(66, 133, 244, 0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '1.4rem' }}>🖼️</span>
          <span className="remote-section-title" style={{ color: '#4285f4', marginBottom: 0 }}>Google Photos Link</span>
        </div>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.4, color: 'rgba(255,255,255,0.7)', marginBottom: '16px' }}>
          Authorise Lumina to fetch albums directly from your private Google Photos archive. These client credentials are stored in Lumina&apos;s shared `.env` file.
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
  );
}

export default ImageFeedsTab;
