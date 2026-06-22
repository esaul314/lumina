import { useState, useEffect, useRef } from 'react';
import { 
  Sun, Moon, Palette, Sliders, Smartphone, Image as ImageIcon, RefreshCw, 
  ChevronLeft, ChevronRight, Check, Eye, EyeOff, HelpCircle, Sparkles,
  Clock, CloudRain, MapPin, Trash2, Maximize, Layout
} from 'lucide-react';

function RemoteControl({ state, socket, connected, connectionInfo }) {
  const [touchStartX, setTouchStartX] = useState(0);
  const [swipeStatus, setSwipeStatus] = useState('Swipe left or right to change photo');
  const [activeTab, setActiveTab] = useState('controls'); // controls, settings, photos
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [isSavedEnv, setIsSavedEnv] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const remoteOrientationCache = useRef({});
  const remoteDimensionsCache = useRef({});
  const [activePhotoOrientation, setActivePhotoOrientation] = useState('landscape');
  const [localSecondPhoto, setLocalSecondPhoto] = useState(null);
  const secondPhoto = state.activeSecondPhoto || localSecondPhoto;

  const previewContainerRef = useRef(null);
  const [previewDimensions, setPreviewDimensions] = useState({ width: 350, height: 180 });

  const [activePhotoCrop, setActivePhotoCrop] = useState(50);
  const cropTimeoutRef = useRef(null);

  const [dragState, setDragState] = useState({
    isDragging: false,
    startY: 0,
    startCropY: 50,
    photoUrl: null,
    isSecond: false
  });
  const [currentDragY, setCurrentDragY] = useState(null);

  useEffect(() => {
    if (state.activePhoto) {
      const isSplitLayoutActive = state.splitPortrait && activePhotoOrientation === 'portrait' && secondPhoto;
      if (state.activePhoto.cropPercent !== undefined) {
        setActivePhotoCrop(state.activePhoto.cropPercent);
      } else if (isSplitLayoutActive) {
        setActivePhotoCrop(state.splitCropPercent !== undefined ? state.splitCropPercent : 50);
      } else {
        setActivePhotoCrop(state.scaleMode === 'contain' ? 0 : 100);
      }
    }
  }, [state.activePhoto?.url, state.activePhoto?.cropPercent, state.splitCropPercent, state.scaleMode, state.splitPortrait, activePhotoOrientation, secondPhoto]);

  useEffect(() => {
    return () => {
      if (cropTimeoutRef.current) {
        clearTimeout(cropTimeoutRef.current);
      }
    };
  }, []);

  const handleDragStart = (e, photoUrl, isSecond) => {
    if (!photoUrl) return;
    e.preventDefault();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const photoObj = isSecond ? secondPhoto : state.activePhoto;
    const currentCropY = photoObj && photoObj.cropPositionY !== undefined ? photoObj.cropPositionY : 50;

    setDragState({
      isDragging: true,
      startY: clientY,
      startCropY: currentCropY,
      photoUrl: photoUrl,
      isSecond: isSecond
    });
    setCurrentDragY(currentCropY);
  };

  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleDragMove = (e) => {
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - dragState.startY;

      const containerHeight = previewDimensions.height;
      const sensitivity = 0.8;
      const deltaPercent = (deltaY / containerHeight) * 100 * sensitivity;

      let newCropY = Math.round(dragState.startCropY - deltaPercent);
      newCropY = Math.max(0, Math.min(100, newCropY));

      setCurrentDragY(newCropY);

      if (cropTimeoutRef.current) {
        clearTimeout(cropTimeoutRef.current);
      }

      cropTimeoutRef.current = setTimeout(() => {
        socket.emit('set-photo-crop', {
          url: dragState.photoUrl,
          cropPositionY: newCropY
        });
      }, 30);
    };

    const handleDragEnd = () => {
      setDragState(prev => ({ ...prev, isDragging: false }));
      setCurrentDragY(null);
    };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [dragState, previewDimensions.height, socket]);


  const handlePhotoCropChange = (val) => {
    const numericVal = parseInt(val, 10);
    setActivePhotoCrop(numericVal);

    if (cropTimeoutRef.current) {
      clearTimeout(cropTimeoutRef.current);
    }

    cropTimeoutRef.current = setTimeout(() => {
      if (state.activePhoto) {
        socket.emit('set-photo-crop', {
          url: state.activePhoto.url,
          cropPercent: numericVal
        });
      }
    }, 200); // 200ms debounce
  };



  useEffect(() => {
    if (!previewContainerRef.current) return;
    const updateDims = () => {
      const rect = previewContainerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setPreviewDimensions({ width: rect.width, height: rect.height });
      }
    };
    updateDims();
    window.addEventListener('resize', updateDims);
    return () => window.removeEventListener('resize', updateDims);
  }, [activeTab, state.activePhoto?.url]);

  // Sync orientation cache and active photo preview layout
  useEffect(() => {
    if (!state.activePhoto) {
      setActivePhotoOrientation('landscape');
      setLocalSecondPhoto(null);
      return;
    }

    const checkActivePhoto = () => {
      const activeUrl = state.activePhoto.url;
      const cached = remoteOrientationCache.current[activeUrl];
      
      const processActiveOrientation = (isPortrait) => {
        setActivePhotoOrientation(isPortrait ? 'portrait' : 'landscape');
        
        const activePreventPairing = state.activePhoto.preventPairing === true;
        if (isPortrait && state.splitPortrait && !activePreventPairing && state.photosList && state.photosList.length > 1) {
          // Look for another photo that is cached as portrait and has dimensions cached and belongs to the same category
          const cachedPortraits = state.photosList.filter(p => 
            p.url !== activeUrl && 
            remoteOrientationCache.current[p.url] === 'portrait' &&
            p.preventPairing !== true &&
            remoteDimensionsCache.current[p.url] &&
            (p.category && state.activePhoto.category && p.category === state.activePhoto.category)
          );
          
          if (cachedPortraits.length > 0) {
            setLocalSecondPhoto(cachedPortraits[Math.floor(Math.random() * cachedPortraits.length)]);
          } else {
            // Find candidates in the same category
            const candidates = state.photosList.filter(p => 
              p.url !== activeUrl && 
              remoteOrientationCache.current[p.url] !== 'landscape' &&
              p.preventPairing !== true &&
              (p.category && state.activePhoto.category && p.category === state.activePhoto.category)
            ).slice(0, 8);
            
            const findSecondSequentially = (index) => {
              if (index >= candidates.length) {
                setLocalSecondPhoto(null);
                return;
              }
              const cand = candidates[index];
              const cImg = new window.Image();
              cImg.src = cand.url;
              cImg.onload = () => {
                const isCandPortrait = cImg.naturalHeight > cImg.naturalWidth;
                remoteOrientationCache.current[cand.url] = isCandPortrait ? 'portrait' : 'landscape';
                remoteDimensionsCache.current[cand.url] = {
                  w: cImg.naturalWidth,
                  h: cImg.naturalHeight
                };
                if (isCandPortrait) {
                  setLocalSecondPhoto(cand);
                } else {
                  findSecondSequentially(index + 1);
                }
              };
              cImg.onerror = () => {
                remoteOrientationCache.current[cand.url] = 'landscape';
                findSecondSequentially(index + 1);
              };
            };
            findSecondSequentially(0);
          }
        } else {
          setLocalSecondPhoto(null);
        }
      };

      const cachedDims = remoteDimensionsCache.current[activeUrl];
      if (cached && cachedDims) {
        processActiveOrientation(cached === 'portrait');
      } else {
        const img = new window.Image();
        img.src = activeUrl;
        img.onload = () => {
          const isPortrait = img.naturalHeight > img.naturalWidth;
          remoteOrientationCache.current[activeUrl] = isPortrait ? 'portrait' : 'landscape';
          remoteDimensionsCache.current[activeUrl] = {
            w: img.naturalWidth,
            h: img.naturalHeight
          };
          processActiveOrientation(isPortrait);
        };
        img.onerror = () => {
          remoteOrientationCache.current[activeUrl] = 'landscape';
          processActiveOrientation(false);
        };
      }
    };

    checkActivePhoto();
  }, [state.activePhoto?.url, state.activePhoto?.preventPairing, state.splitPortrait, state.photosList]);
  const [keywordCategory, setKeywordCategory] = useState('Scenic Nature');
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryKeyword, setNewCategoryKeyword] = useState('');

  useEffect(() => {
    const validKeys = Object.keys(state.searchKeywords || {});
    if (validKeys.length > 0 && !validKeys.includes(keywordCategory)) {
      setKeywordCategory(validKeys[0]);
    }
  }, [state.searchKeywords, keywordCategory]);
  const [imageStatus, setImageStatus] = useState('loading'); // loading, loaded, failed

  const [manualCity, setManualCity] = useState(state.manualLocation?.city || 'Verdun');
  const [manualRegion, setManualRegion] = useState(state.manualLocation?.regionName || 'Quebec');
  const [manualCountry, setManualCountry] = useState(state.manualLocation?.country || 'Canada');
  const [manualLat, setManualLat] = useState(state.manualLocation?.lat || 45.45);
  const [manualLon, setManualLon] = useState(state.manualLocation?.lon || -73.56);

  const [useapiToken, setUseapiToken] = useState('');
  const [recrawlStatus, setRecrawlStatus] = useState('idle'); // idle, loading, success, error
  const [useapiStatus, setUseapiStatus] = useState('idle'); // idle, success, error
  const [recrawlCount, setRecrawlCount] = useState(0);

  // Sync manual location states when state updates from Socket
  useEffect(() => {
    if (state.manualLocation) {
      setManualCity(state.manualLocation.city || '');
      setManualRegion(state.manualLocation.regionName || '');
      setManualCountry(state.manualLocation.country || '');
      setManualLat(state.manualLocation.lat !== undefined ? state.manualLocation.lat : '');
      setManualLon(state.manualLocation.lon !== undefined ? state.manualLocation.lon : '');
    }
  }, [state.manualLocation]);

  // Socket listeners for Admin panel feedback
  useEffect(() => {
    if (!socket) return;

    const handleRecrawlComplete = (data) => {
      if (data.success) {
        setRecrawlStatus('success');
        setRecrawlCount(data.count);
      } else {
        setRecrawlStatus('error');
      }
      setTimeout(() => setRecrawlStatus('idle'), 4000);
    };

    const handleUseApiSaved = (data) => {
      if (data.success) {
        setUseapiStatus('success');
        setUseapiToken('');
      } else {
        setUseapiStatus('error');
      }
      setTimeout(() => setUseapiStatus('idle'), 4000);
    };

    socket.on('recrawl-complete', handleRecrawlComplete);
    socket.on('useapi-token-saved', handleUseApiSaved);

    return () => {
      socket.off('recrawl-complete', handleRecrawlComplete);
      socket.off('useapi-token-saved', handleUseApiSaved);
    };
  }, [socket]);

  // Detect returning OAuth success from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('googleAuth') === 'success') {
      setIsSavedEnv(true);
    }
  }, []);

  // Preload and monitor the active gallery photo URL
  useEffect(() => {
    if (!state.photosList || state.photosList.length === 0) return;
    const photo = state.photosList[galleryIndex];
    if (!photo) return;

    setImageStatus('loading');
    const img = new Image();
    img.src = photo.url;
    
    img.onload = () => {
      setImageStatus('loaded');
    };
    
    img.onerror = () => {
      setImageStatus('failed');
      console.warn(`[Independent Rating Deck] Failed to load image URL: ${photo.url}`);
      // Automatically report broken link to server
      socket.emit('mark-photo-broken', { url: photo.url });
    };
  }, [galleryIndex, state.photosList]);

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
  const saveGoogleCredentials = async (e) => {
    e.preventDefault();
    if (googleClientId && googleClientSecret) {
      try {
        const res = await fetch('/api/auth/google/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: googleClientId, clientSecret: googleClientSecret })
        });
        const data = await res.json();
        if (data.success) {
          setIsSavedEnv(true);
          // Redirect to OAuth login portal on the server
          window.location.href = '/api/auth/google/login';
        } else {
          alert('Failed to register Google Photos credentials on server.');
        }
      } catch (err) {
        console.error('Failed to post credentials:', err);
        alert('Network error connecting to Google Auth Endpoint.');
      }
    }
  };

  const categories = [
    ...Object.keys(state.searchKeywords || {}),
    'Google Photos'
  ];

  const handleCreateCategory = () => {
    const name = newCategoryName.trim();
    const kw = newCategoryKeyword.trim();
    if (!name || !kw) {
      alert('Please fill out both pool name and initial keyword(s).');
      return;
    }
    const cleanName = name.replace(/,/g, ' ');
    if (cleanName.toLowerCase() === 'google photos') {
      alert('Reserved name. Please choose a different name.');
      return;
    }
    socket.emit('add-category', { category: cleanName, keyword: kw });
    setNewCategoryName('');
    setNewCategoryKeyword('');
  };

  const handleDeleteCategory = (catToDelete) => {
    if (window.confirm(`Are you sure you want to delete the scenic pool "${catToDelete}"? This cannot be undone.`)) {
      socket.emit('delete-category', { category: catToDelete });
    }
  };

  const getSplitPreviewStyle = (url, isSecond) => {
    const photoObj = isSecond ? secondPhoto : state.activePhoto;
    const cachedDims = photoObj ? remoteDimensionsCache.current[photoObj.url] : null;

    let R_i = 0.667;
    if (cachedDims && cachedDims.w && cachedDims.h) {
      R_i = cachedDims.w / cachedDims.h;
    } else {
      const isPortrait = isSecond ? true : (activePhotoOrientation === 'portrait');
      R_i = isPortrait ? 0.667 : 1.5;
    }
    const padWidth = previewDimensions.width;
    const padHeight = previewDimensions.height;

    const halfWidth = (padWidth - 18) / 2;
    const halfHeight = padHeight - 12;
    const R_c = halfWidth / halfHeight;

    const P = !isSecond
      ? activePhotoCrop
      : (photoObj && photoObj.cropPercent !== undefined 
         ? photoObj.cropPercent 
         : (state.splitCropPercent !== undefined ? state.splitCropPercent : 50));

    const P_y = (dragState.isDragging && dragState.photoUrl === url && currentDragY !== null)
      ? currentDragY
      : (photoObj && photoObj.cropPositionY !== undefined ? photoObj.cropPositionY : 50);

    let wDisp, hDisp;
    if (R_i < R_c) {
      const hContain = halfHeight;
      const hCover = halfWidth / R_i;
      hDisp = hContain + (hCover - hContain) * (P / 100);
      wDisp = hDisp * R_i;
    } else {
      const wContain = halfWidth;
      const wCover = halfHeight * R_i;
      wDisp = wContain + (wCover - wContain) * (P / 100);
      hDisp = wDisp / R_i;
    }

    return {
      backgroundImage: `url(${url})`,
      backgroundSize: `${Math.round(wDisp)}px ${Math.round(hDisp)}px`,
      backgroundPosition: `center ${P_y}%`,
      backgroundRepeat: 'no-repeat',
      borderRadius: '8px',
      backgroundColor: '#0c0a0f'
    };
  };

  const getSinglePreviewStyle = (url) => {
    const photoObj = state.activePhoto;
    if (!photoObj) return {};
    const cachedDims = remoteDimensionsCache.current[photoObj.url];

    let R_i = 1.5;
    if (cachedDims && cachedDims.w && cachedDims.h) {
      R_i = cachedDims.w / cachedDims.h;
    } else {
      R_i = activePhotoOrientation === 'portrait' ? 0.667 : 1.5;
    }
    const padWidth = previewDimensions.width;
    const padHeight = previewDimensions.height;

    const R_c = padWidth / padHeight;

    const P = activePhotoCrop;

    const P_y = (dragState.isDragging && dragState.photoUrl === url && currentDragY !== null)
      ? currentDragY
      : (photoObj && photoObj.cropPositionY !== undefined ? photoObj.cropPositionY : 50);

    let wDisp, hDisp;
    if (R_i < R_c) {
      const hContain = padHeight;
      const hCover = padWidth / R_i;
      hDisp = hContain + (hCover - hContain) * (P / 100);
      wDisp = hDisp * R_i;
    } else {
      const wContain = padWidth;
      const wCover = padHeight * R_i;
      wDisp = wContain + (wCover - wContain) * (P / 100);
      hDisp = wDisp / R_i;
    }

    return {
      backgroundImage: `url(${url})`,
      backgroundSize: `${Math.round(wDisp)}px ${Math.round(hDisp)}px`,
      backgroundPosition: `center ${P_y}%`,
      backgroundRepeat: 'no-repeat',
      backgroundColor: '#0c0a0f'
    };
  };


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
          <ImageIcon size={16} /> Image Feeds
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Pool Name (e.g. Classic Art)"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
                <input
                  type="text"
                  placeholder="Keywords (e.g. oil renaissance)"
                  value={newCategoryKeyword}
                  onChange={(e) => setNewCategoryKeyword(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>
              <button
                onClick={handleCreateCategory}
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
                              const img = new Image();
                              img.src = photo.url;
                              img.onload = () => setImageStatus('loaded');
                              img.onerror = () => setImageStatus('failed');
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
              Configure search keywords, subreddits, or Tumblr blogs for each image source in this scenic pool.
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

                            let parsedVal = inputVal;
                            const timeRangeRegex = /^\[([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]\]\s+(.+)$/;
                            const match = inputVal.match(timeRangeRegex);
                            if (match) {
                              const [_, start, end, kwsStr] = match;
                              parsedVal = {
                                timeStart: start,
                                timeEnd: end,
                                keywords: kwsStr.split(',').map(kw => kw.trim()).filter(Boolean)
                              };
                            }

                            const isDuplicate = paramsList.some(item => {
                              if (typeof item === 'string' && typeof parsedVal === 'string') {
                                  return item.toLowerCase() === parsedVal.toLowerCase();
                              }
                              if (item && typeof item === 'object' && parsedVal && typeof parsedVal === 'object') {
                                  return item.timeStart === parsedVal.timeStart &&
                                         item.timeEnd === parsedVal.timeEnd &&
                                         JSON.stringify(item.keywords) === JSON.stringify(parsedVal.keywords);
                              }
                              return false;
                            });
                            if (isDuplicate) {
                              alert('This configuration parameter already exists.');
                              return;
                            }

                            const nextParams = [...paramsList, parsedVal];
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
                  onClick={() => socket.emit('change-scale-mode', state.scaleMode === 'contain' ? 'cover' : 'contain')}
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
                  onClick={() => socket.emit('toggle-split-portrait', !state.splitPortrait)}
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
                      onChange={(e) => socket.emit('change-split-crop', parseInt(e.target.value))}
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
                        onChange={(e) => socket.emit('update-vision-config', { ...state.visionConfig, apiUrl: e.target.value })}
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
                          onChange={(e) => socket.emit('update-vision-config', { ...state.visionConfig, model: e.target.value })}
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
                          onChange={(e) => socket.emit('update-vision-config', { ...state.visionConfig, apiKey: e.target.value })}
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
                        onClick={() => socket.emit('toggle-allow-openai-fallback', !state.allowOpenAiFallback)}
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
                            onChange={(e) => socket.emit('update-vision-config', { ...state.visionConfig, fallbackUrl: e.target.value })}
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
                              onChange={(e) => socket.emit('update-vision-config', { ...state.visionConfig, fallbackModel: e.target.value })}
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
                              onChange={(e) => socket.emit('update-vision-config', { ...state.visionConfig, fallbackApiKey: e.target.value })}
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
                  onClick={() => socket.emit('toggle-auto-location', !state.autoLocation)}
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
                      socket.emit('update-manual-location', {
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
            <span className="remote-section-title">Exclusion Keywords</span>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', marginTop: '-8px', lineHeight: 1.3 }}>
              Exclude matching wallpapers globally from slideshow feeds (e.g. "anime", "hentai", "car").
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
                        socket.emit('update-excluded-keywords', updated);
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
                    socket.emit('update-excluded-keywords', [...current, kw]);
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
            <span className="remote-section-title">Database & Feed Management</span>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', marginTop: '-8px', lineHeight: 1.3 }}>
              Manually trigger the background crawler to query all active photography APIs (Reddit, Lexica, Unsplash, Wallhaven, NASA, Midjourney) and load fresh landscape images instantly.
            </p>
            {recrawlStatus === 'loading' ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <RefreshCw size={18} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>Crawling web feeds & self-healing links...</span>
              </div>
            ) : recrawlStatus === 'success' ? (
              <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10b981', padding: '12px', borderRadius: '12px', color: '#10b981', textAlign: 'center', fontSize: '0.85rem', fontWeight: 500 }}>
                ✓ Feeds Recrawled Successfully! Now showing {recrawlCount} images.
              </div>
            ) : recrawlStatus === 'error' ? (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', padding: '12px', borderRadius: '12px', color: '#ef4444', textAlign: 'center', fontSize: '0.85rem', fontWeight: 500 }}>
                ✗ Recrawl failed. Check server logs for API boundaries.
              </div>
            ) : (
              <button 
                onClick={() => {
                  setRecrawlStatus('loading');
                  socket.emit('trigger-recrawl');
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
              Lumina crawls Midjourney AI landscape creations via UseAPI.net. Enter your UseAPI token below to enable direct casting.
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
                onClick={() => {
                  if (!useapiToken.trim()) {
                    alert('Please enter a valid token.');
                    return;
                  }
                  socket.emit('save-useapi-token', { token: useapiToken.trim() });
                }}
                className="remote-btn" 
                style={{ background: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)', fontSize: '0.85rem' }}
              >
                Update Midjourney Token
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
      )}

      {/* Footer Info */}
      <p style={{ fontSize: '0.75rem', opacity: 0.35, marginTop: '16px', letterSpacing: '0.05em' }}>
        LUMINA SYSTEM v1.0.0 • POWERED BY GOOGLE DEEPMIND
      </p>
    </div>
  );
}

export default RemoteControl;
