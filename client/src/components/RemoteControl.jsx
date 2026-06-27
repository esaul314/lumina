import { useState, useEffect, useRef } from 'react';
import { 
  Sliders, Smartphone, Image as ImageIcon
} from 'lucide-react';
import DirectControlTab from './remote/DirectControlTab';
import ImageFeedsTab from './remote/ImageFeedsTab';
import SystemSettingsTab from './remote/SystemSettingsTab';

// Import our custom hooks
import { useLuminaActions } from '../hooks/useLuminaActions';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { useCropDrag } from '../hooks/useCropDrag';
import { useActivePhotoSync } from '../hooks/useActivePhotoSync';
import { useImagePreloader } from '../hooks/useImagePreloader';

function RemoteControl({ state, socket, connected, connectionInfo }) {
  const [activeTab, setActiveTab] = useState('controls'); // controls, settings, photos
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [isSavedEnv, setIsSavedEnv] = useState(false);

  // Caches for orientation and dimensions
  const remoteOrientationCache = useRef({});
  const remoteDimensionsCache = useRef({});

  // 1. Socket Actions Helper Hook
  const actions = useLuminaActions(socket);

  // 2. Active Photo Orientation & Secondary Split Pairing Sync Hook
  const { 
    activePhotoOrientation, 
    localSecondPhoto 
  } = useActivePhotoSync(state, remoteDimensionsCache, remoteOrientationCache);
  const secondPhoto = state.currentFrame?.secondary || state.activeSecondPhoto || localSecondPhoto;

  // 3. Swipe & Touch Gesture Controller Hook
  const { 
    swipeStatus, 
    handleTouchStart, 
    handleTouchEnd, 
    triggerNext, 
    triggerPrev 
  } = useSwipeGesture(actions);

  // 4. Crop & Vertical Positioning Drag Physics Hook
  const previewContainerRef = useRef(null);
  const [previewDimensions, setPreviewDimensions] = useState({ width: 350, height: 180 });
  const { 
    dragState, 
    currentDragY, 
    handleDragStart 
  } = useCropDrag(actions, state, secondPhoto, previewDimensions);

  // 5. Active Photo Crop (Debounced range input) State
  const [activePhotoCrop, setActivePhotoCrop] = useState(50);
  const cropTimeoutRef = useRef(null);

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

  const handlePhotoCropChange = (val) => {
    const numericVal = parseInt(val, 10);
    setActivePhotoCrop(numericVal);

    if (cropTimeoutRef.current) {
      clearTimeout(cropTimeoutRef.current);
    }

    cropTimeoutRef.current = setTimeout(() => {
      if (state.activePhoto) {
        actions.setPhotoCrop(state.activePhoto.url, numericVal);
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

  // 6. Feeds Tab Independent Rating Deck Preloader Hook
  const [galleryIndex, setGalleryIndex] = useState(0);
  const activeGalleryPhoto = state.photosList && state.photosList[galleryIndex] ? state.photosList[galleryIndex] : null;
  
  const { imageStatus, setImageStatus } = useImagePreloader(
    activeGalleryPhoto ? activeGalleryPhoto.url : null,
    actions,
    remoteDimensionsCache,
    remoteOrientationCache
  );

  // Bounds check galleryIndex if the photos list changes
  useEffect(() => {
    if (state.photosList && galleryIndex >= state.photosList.length) {
      setGalleryIndex(0);
    }
  }, [state.photosList, galleryIndex]);

  // Tab Panel Helpers mapping local variables to abstracted actions
  const [keywordCategory, setKeywordCategory] = useState('Scenic Nature');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryKeyword, setNewCategoryKeyword] = useState('');

  useEffect(() => {
    const validKeys = Object.keys(state.searchKeywords || {});
    if (validKeys.length > 0 && !validKeys.includes(keywordCategory)) {
      setKeywordCategory(validKeys[0]);
    }
  }, [state.searchKeywords, keywordCategory]);

  const [manualCity, setManualCity] = useState(state.manualLocation?.city || 'Verdun');
  const [manualRegion, setManualRegion] = useState(state.manualLocation?.regionName || 'Quebec');
  const [manualCountry, setManualCountry] = useState(state.manualLocation?.country || 'Canada');
  const [manualLat, setManualLat] = useState(state.manualLocation?.lat || 45.45);
  const [manualLon, setManualLon] = useState(state.manualLocation?.lon || -73.56);

  const [useapiToken, setUseapiToken] = useState('');
  const [recrawlStatus, setRecrawlStatus] = useState('idle'); // idle, loading, success, error
  const [useapiStatus, setUseapiStatus] = useState('idle'); // idle, success, error
  const [recrawlCount, setRecrawlCount] = useState(0);

  useEffect(() => {
    if (state.manualLocation) {
      setManualCity(state.manualLocation.city || '');
      setManualRegion(state.manualLocation.regionName || '');
      setManualCountry(state.manualLocation.country || '');
      setManualLat(state.manualLocation.lat !== undefined ? state.manualLocation.lat : '');
      setManualLon(state.manualLocation.lon !== undefined ? state.manualLocation.lon : '');
    }
  }, [state.manualLocation]);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('googleAuth') === 'success') {
      setIsSavedEnv(true);
    }
  }, []);

  const handleToggleWidget = (widgetName, currentValue) => {
    actions.toggleWidget(widgetName, !currentValue);
  };

  const handleThemeChange = (themeName) => {
    actions.changeTheme(themeName);
  };

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
    actions.changeCategory(newCats.join(','));
  };

  const forceScreensaverToggle = () => {
    actions.setScreensaverActive(!state.screensaverActive);
  };

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
    actions.addCategory(cleanName, kw);
    setNewCategoryName('');
    setNewCategoryKeyword('');
  };

  const handleDeleteCategory = (catToDelete) => {
    if (window.confirm(`Are you sure you want to delete the scenic pool "${catToDelete}"? This cannot be undone.`)) {
      actions.deleteCategory(catToDelete);
    }
  };
  const categories = [
    ...Object.keys(state.searchKeywords || {}),
    'Google Photos'
  ];

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

  const getGalleryPhotoPreviewStyle = (photo) => {
    if (!photo) return {};
    const cachedDims = remoteDimensionsCache.current[photo.url];

    let R_i = 1.5;
    if (cachedDims && cachedDims.w && cachedDims.h) {
      R_i = cachedDims.w / cachedDims.h;
    } else {
      const isPortrait = remoteOrientationCache.current[photo.url] === 'portrait';
      R_i = isPortrait ? 0.667 : 1.5;
    }
    const padWidth = previewDimensions.width || 350;
    const padHeight = 160;

    const R_c = padWidth / padHeight;

    const defaultP = state.scaleMode === 'contain' ? 0 : 100;
    const P = photo.cropPercent !== undefined ? photo.cropPercent : defaultP;
    const P_y = (dragState.isDragging && dragState.photoUrl === photo.url && currentDragY !== null)
      ? currentDragY
      : (photo.cropPositionY !== undefined ? photo.cropPositionY : 50);

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
      backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.6)), url(${photo.url})`,
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

      {/* 3. Active Panel Component */}
      {activeTab === 'controls' && (
        <DirectControlTab
          state={state}
          socket={socket}
          activePhotoOrientation={activePhotoOrientation}
          secondPhoto={secondPhoto}
          dragState={dragState}
          currentDragY={currentDragY}
          activePhotoCrop={activePhotoCrop}
          previewContainerRef={previewContainerRef}
          swipeStatus={swipeStatus}
          handleTouchStart={handleTouchStart}
          handleTouchEnd={handleTouchEnd}
          handleDragStart={handleDragStart}
          getSplitPreviewStyle={getSplitPreviewStyle}
          getSinglePreviewStyle={getSinglePreviewStyle}
          handlePhotoCropChange={handlePhotoCropChange}
          triggerPrev={triggerPrev}
          triggerNext={triggerNext}
          forceScreensaverToggle={forceScreensaverToggle}
          themes={themes}
          handleThemeChange={handleThemeChange}
        />
      )}

      {activeTab === 'photos' && (
        <ImageFeedsTab
          state={state}
          socket={socket}
          categories={categories}
          handleCategoryChange={handleCategoryChange}
          handleDeleteCategory={handleDeleteCategory}
          newCategoryName={newCategoryName}
          setNewCategoryName={setNewCategoryName}
          newCategoryKeyword={newCategoryKeyword}
          setNewCategoryKeyword={setNewCategoryKeyword}
          handleCreateCategory={handleCreateCategory}
          galleryIndex={galleryIndex}
          setGalleryIndex={setGalleryIndex}
          imageStatus={imageStatus}
          setImageStatus={setImageStatus}
          handleDragStart={handleDragStart}
          dragState={dragState}
          getGalleryPhotoPreviewStyle={getGalleryPhotoPreviewStyle}
          remoteOrientationCache={remoteOrientationCache}
          keywordCategory={keywordCategory}
          setKeywordCategory={setKeywordCategory}
          isSavedEnv={isSavedEnv}
          googleClientId={googleClientId}
          setGoogleClientId={setGoogleClientId}
          googleClientSecret={googleClientSecret}
          setGoogleClientSecret={setGoogleClientSecret}
          saveGoogleCredentials={saveGoogleCredentials}
        />
      )}

      {activeTab === 'settings' && (
        <SystemSettingsTab
          state={state}
          socket={socket}
          connectionInfo={connectionInfo}
          handleToggleWidget={handleToggleWidget}
          manualCity={manualCity}
          setManualCity={setManualCity}
          manualRegion={manualRegion}
          setManualRegion={setManualRegion}
          manualCountry={manualCountry}
          setManualCountry={setManualCountry}
          manualLat={manualLat}
          setManualLat={setManualLat}
          manualLon={manualLon}
          setManualLon={setManualLon}
          useapiToken={useapiToken}
          setUseapiToken={setUseapiToken}
          recrawlStatus={recrawlStatus}
          setRecrawlStatus={setRecrawlStatus}
          useapiStatus={useapiStatus}
          recrawlCount={recrawlCount}
        />
      )}

      {/* Footer Info */}
      <p style={{ fontSize: '0.75rem', opacity: 0.35, marginTop: '16px', letterSpacing: '0.05em' }}>
        LUMINA SYSTEM v1.0.0 • POWERED BY GOOGLE DEEPMIND
      </p>
    </div>
  );
}

export default RemoteControl;
