import { useState, useEffect, useRef } from 'react';
import { Sun, Cloud, CloudRain, CloudSnow, Clock, MapPin, Settings, X, Check, RefreshCw, Droplets } from 'lucide-react';
import {
  findPhotoByUrl,
  getCurrentFrame,
  getFramePhoto,
  getPhotoCropState,
  isSplitFrameActive
} from '../state/frameSelectors';

/**
 * 🖼️ loadImageMeta
 * Pure Promise wrapper around native HTML Image element loading to extract dimensions and orientation.
 * Always binds event handlers before setting src to ensure cached loads are handled correctly.
 */
const loadImageMeta = (url) => new Promise((resolve, reject) => {
  const img = new window.Image();
  img.onload = () => {
    resolve({
      url,
      w: img.naturalWidth,
      h: img.naturalHeight,
      orientation: img.naturalHeight > img.naturalWidth ? 'portrait' : 'landscape'
    });
  };
  img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
  img.src = url;
});

function Dashboard({ state, socket, connectionInfo }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState(null);
  const [isScreensaverActive, setIsScreensaverActive] = useState(true);
  const [activeSlides, setActiveSlides] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const cursorTimeoutRef = useRef(null);


  const inactivityTimerRef = useRef(null);
  const particleCanvasRef = useRef(null);
  const mountTimeRef = useRef(Date.now());
  const consecutiveFailuresRef = useRef(0);
  const imageOrientationCache = useRef({}); // { [url]: 'portrait' | 'landscape' }
  const imageDimensionsCache = useRef({}); // { [url]: { w, h } }
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const currentFrame = getCurrentFrame(state);
  const primaryPhoto = getFramePhoto(state, 'primary');
  const secondaryPhoto = getFramePhoto(state, 'secondary');

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Weather code to text & icon mapper
  const getWeatherInfo = (code) => {
    if (code === 0) return { text: 'Clear Sky', icon: <Sun className="weather-icon-sun" style={{ color: '#fbbf24' }} /> };
    if ([1, 2, 3].includes(code)) return { text: 'Partly Cloudy', icon: <Cloud style={{ color: '#cbd5e1' }} /> };
    if ([45, 48].includes(code)) return { text: 'Foggy Mist', icon: <Cloud style={{ color: '#94a3b8' }} /> };
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { text: 'Rainy Showers', icon: <CloudRain style={{ color: '#60a5fa' }} /> };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { text: 'Gentle Snow', icon: <CloudSnow style={{ color: '#e2e8f0' }} /> };
    return { text: 'Atmospheric', icon: <Cloud style={{ color: '#cbd5e1' }} /> };
  };

  // 1. Clock Sync
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Weather Fetch
  const fetchWeather = async () => {
    try {
      const res = await fetch('/api/weather');
      const data = await res.json();
      if (data && !data.error) {
        setWeather(data);
      }
    } catch (e) {
      console.error('Failed to load weather data', e);
    }
  };

  useEffect(() => {
    fetchWeather();
    // Refresh weather every 30 minutes
    const weatherTimer = setInterval(fetchWeather, 1800000);
    return () => clearInterval(weatherTimer);
  }, []);

  // 3. Image Category Initial Fetch & Periodic Cycle
  const fetchPhotos = async (category) => {
    // If active photo is already initialized by server state-sync with a valid URL, skip redundant selection to prevent race conditions
    if (primaryPhoto && primaryPhoto.url && primaryPhoto.url.startsWith('http')) return;

    try {
      const res = await fetch(`/api/photos?category=${encodeURIComponent(category)}`);
      const photos = await res.json();
      if (photos && photos.length > 0) {
        // Randomly select one photo to start with
        const rand = photos[Math.floor(Math.random() * photos.length)];
        socket.emit('set-active-photo', rand);
      }
    } catch (e) {
      console.error('Failed to fetch photos', e);
    }
  };

  useEffect(() => {
    fetchPhotos(state.currentCategory);
  }, [state.currentCategory, primaryPhoto?.url]);

  // Slideshow auto-rotation based on global slideshowInterval (dynamic cycle timing)
  useEffect(() => {
    const intervalMs = state.slideshowInterval || 120000; // Default 2 minutes
    const rotateInterval = setInterval(() => {
      // Only change if the screensaver is active
      if (isScreensaverActive) {
        socket.emit('next-photo');
      }
    }, intervalMs);
    return () => clearInterval(rotateInterval);
  }, [isScreensaverActive, state.slideshowInterval]);

  // Memory optimization: Dynamically keep at most TWO slides in the DOM at any given time.
  // One is the currently active slide, and one is the previous slide transitioning out.
  // This drops Chromium's memory footprint from >1.5GB down to <80MB, preventing GPU out-of-memory locks.
  useEffect(() => {
    if (!primaryPhoto) return;

    let active = true;

    // Check if this photo is already our current active slide with the same split layout setting
    const currentActiveSlide = activeSlides.find(s => s.active);
    const expectedSplit = isSplitFrameActive(state);

    // Ensure that if a split layout is expected, the slide's secondary photo URL matches the target secondary URL
    const targetSecondUrl = secondaryPhoto?.url;
    const isSecondUrlMatched = !expectedSplit || (currentActiveSlide && currentActiveSlide.url2 === targetSecondUrl);

    if (
      currentActiveSlide && 
      currentActiveSlide.url === primaryPhoto.url && 
      !!currentActiveSlide.isSplit === expectedSplit &&
      isSecondUrlMatched
    ) {
      const livePrimaryPhoto = findPhotoByUrl(state, primaryPhoto.url, primaryPhoto);
      const liveSecondaryPhoto = expectedSplit && targetSecondUrl
        ? findPhotoByUrl(state, targetSecondUrl, secondaryPhoto || null)
        : null;

      // Check if crop/zoom settings have changed and update the active slide in place
      const currentCrop1 = currentActiveSlide.cropPercent !== undefined 
        ? currentActiveSlide.cropPercent 
        : (expectedSplit ? (state.splitCropPercent !== undefined ? state.splitCropPercent : 50) : (state.scaleMode === 'contain' ? 0 : 100));
      const currentCropY1 = currentActiveSlide.cropPositionY !== undefined ? currentActiveSlide.cropPositionY : 50;

      const targetCrop1 = livePrimaryPhoto?.cropPercent !== undefined 
        ? livePrimaryPhoto.cropPercent 
        : (expectedSplit ? (state.splitCropPercent !== undefined ? state.splitCropPercent : 50) : (state.scaleMode === 'contain' ? 0 : 100));
      const targetCropY1 = livePrimaryPhoto?.cropPositionY !== undefined ? livePrimaryPhoto.cropPositionY : 50;

      const currentCrop2 = expectedSplit 
        ? (currentActiveSlide.cropPercent2 !== undefined ? currentActiveSlide.cropPercent2 : (state.splitCropPercent !== undefined ? state.splitCropPercent : 50))
        : undefined;
      const currentCropY2 = expectedSplit ? (currentActiveSlide.cropPositionY2 !== undefined ? currentActiveSlide.cropPositionY2 : 50) : undefined;

      const targetCrop2 = expectedSplit 
        ? (liveSecondaryPhoto?.cropPercent !== undefined ? liveSecondaryPhoto.cropPercent : (state.splitCropPercent !== undefined ? state.splitCropPercent : 50))
        : undefined;
      const targetCropY2 = expectedSplit ? (liveSecondaryPhoto?.cropPositionY !== undefined ? liveSecondaryPhoto.cropPositionY : 50) : undefined;

      const isSplitCropChanged = expectedSplit && (
        currentCrop1 !== targetCrop1 ||
        currentCropY1 !== targetCropY1 ||
        currentCrop2 !== targetCrop2 ||
        currentCropY2 !== targetCropY2
      );

      const isSingleCropChanged = !expectedSplit && (
        currentCrop1 !== targetCrop1 ||
        currentCropY1 !== targetCropY1
      );

      if (isSplitCropChanged || isSingleCropChanged) {
        setActiveSlides(prev => prev.map(s => {
          if (s.active && s.url === primaryPhoto.url) {
            return {
              ...s,
              cropPercent: livePrimaryPhoto?.cropPercent,
              cropPositionY: livePrimaryPhoto?.cropPositionY,
              cropPercent2: liveSecondaryPhoto?.cropPercent !== undefined 
                ? liveSecondaryPhoto.cropPercent 
                : state.splitCropPercent,
              cropPositionY2: liveSecondaryPhoto?.cropPositionY
            };
          }
          return s;
        }));
      }
      return;
    }

    const addSingleSlide = (photo) => {
      const dims = imageDimensionsCache.current[photo.url] || {};
      setActiveSlides(prev => {
        const newSlide = {
          url: photo.url,
          title: photo.title,
          author: photo.author,
          category: state.currentCategory,
          cropPercent: photo.cropPercent,
          cropPositionY: photo.cropPositionY,
          w: dims.w,
          h: dims.h,
          key: Date.now() + Math.random().toString(36).substr(2, 9),
          active: true,
          isSplit: false
        };
        const inactiveSlides = prev.map(s => ({ ...s, active: false }));
        return [...inactiveSlides.slice(-1), newSlide];
      });
    };

    const addSplitSlide = (photo1, photo2) => {
      const dims1 = imageDimensionsCache.current[photo1.url] || {};
      const dims2 = imageDimensionsCache.current[photo2.url] || {};
      setActiveSlides(prev => {
        const newSlide = {
          url: photo1.url,
          title: photo1.title,
          author: photo1.author,
          w: dims1.w,
          h: dims1.h,
          cropPercent: photo1.cropPercent,
          cropPositionY: photo1.cropPositionY,
          url2: photo2.url,
          title2: photo2.title,
          author2: photo2.author,
          w2: dims2.w,
          h2: dims2.h,
          cropPercent2: photo2.cropPercent,
          cropPositionY2: photo2.cropPositionY,
          category: state.currentCategory,
          key: Date.now() + Math.random().toString(36).substr(2, 9),
          active: true,
          isSplit: true
        };
        const inactiveSlides = prev.map(s => ({ ...s, active: false }));
        return [...inactiveSlides.slice(-1), newSlide];
      });
    };

    const getImageMeta = async (url) => {
      if (imageOrientationCache.current[url] && imageDimensionsCache.current[url]) {
        return {
          url,
          w: imageDimensionsCache.current[url].w,
          h: imageDimensionsCache.current[url].h,
          orientation: imageOrientationCache.current[url]
        };
      }
      const meta = await loadImageMeta(url);
      imageOrientationCache.current[url] = meta.orientation;
      imageDimensionsCache.current[url] = { w: meta.w, h: meta.h };
      return meta;
    };

    const preloadAndMount = async () => {
      try {
        if (!primaryPhoto) return;

        const meta = await getImageMeta(primaryPhoto.url);
        if (!active) return;

        consecutiveFailuresRef.current = 0; // Reset failure counter on successful load

        socket.emit('report-photo-metadata', {
          url: primaryPhoto.url,
          orientation: meta.orientation,
          width: meta.w,
          height: meta.h
        });

        if (expectedSplit && secondaryPhoto) {
          let secondaryLoaded = false;
          try {
            const secondaryMeta = await getImageMeta(secondaryPhoto.url);
            if (active) {
              socket.emit('report-photo-metadata', {
                url: secondaryPhoto.url,
                orientation: secondaryMeta.orientation,
                width: secondaryMeta.w,
                height: secondaryMeta.h
              });
              secondaryLoaded = true;
            }
          } catch (error) {
            console.warn('Failed to load secondary wallpaper image:', secondaryPhoto.url);
            if (active) {
              socket.emit('mark-photo-broken', { url: secondaryPhoto.url });
            }
          }
          if (active) {
            if (secondaryLoaded) {
              addSplitSlide(primaryPhoto, secondaryPhoto);
            } else {
              // Fallback to single slide since secondary photo is broken
              addSingleSlide(primaryPhoto);
            }
          }
        } else {
          if (active) {
            addSingleSlide(primaryPhoto);
          }
        }
      } catch (err) {
        if (!active) return;
        console.warn('Failed to load wallpaper image:', primaryPhoto.url);

        const maxFailures = state.photosList ? state.photosList.length : 5;
        if (consecutiveFailuresRef.current >= maxFailures) {
          console.error('All photos in current feed failed to load. Network might be down. Stopping infinite skip loop.');
          socket.emit('report-media-failure', {
            category: state.currentCategory,
            failedUrls: state.photosList ? state.photosList.map(p => p.url) : [primaryPhoto.url],
            message: 'All wallpapers in this feed failed to load. The display client is likely offline.'
          });
          return;
        }

        if (consecutiveFailuresRef.current < 3) {
          console.log('Reporting specific broken link to server:', primaryPhoto.url);
          socket.emit('mark-photo-broken', { url: primaryPhoto.url });
        }

        consecutiveFailuresRef.current += 1;

        setTimeout(() => {
          if (active) {
            socket.emit('next-photo');
          }
        }, 1500);
      }
    };

    preloadAndMount();

    return () => {
      active = false;
    };
  }, [primaryPhoto, secondaryPhoto, currentFrame.layout, currentFrame.crop.primaryPercent, currentFrame.crop.primaryPositionY, currentFrame.crop.secondaryPercent, currentFrame.crop.secondaryPositionY, state.photosList, state.scaleMode, state.splitCropPercent]);

  // 4. Inactivity & Screensaver Wake/Dismiss Logic
  const resetInactivityTimer = () => {
    // Prevent accidental triggers during the first 5 seconds after mount
    // (Chromium often fires synthetic mousemove/focus events on launch)
    if (Date.now() - mountTimeRef.current < 5000) {
      return;
    }

    // 1. If currently inactive (screensaver running), dismiss it instantly
    if (isScreensaverActive) {
      console.log('User interaction detected: Dismissing screensaver');
      setIsScreensaverActive(false);
      socket.emit('set-screensaver-active', false);
    }

    // 2. Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // 3. Start a new 10-minute timer (600,000ms)
    // For testing and beautiful immediate validation, we will also let it run.
    inactivityTimerRef.current = setTimeout(() => {
      console.log('10 minutes of inactivity: Entering Screensaver Mode');
      setIsScreensaverActive(true);
      socket.emit('set-screensaver-active', true);
    }, state.inactivityTimeout || 600000);
  };

  useEffect(() => {
    // Set up listeners for mouse and keyboard actions
    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('keydown', resetInactivityTimer);
    window.addEventListener('mousedown', resetInactivityTimer);
    window.addEventListener('scroll', resetInactivityTimer);
    window.addEventListener('touchstart', resetInactivityTimer);

    // Initial timer setup
    resetInactivityTimer();

    return () => {
      window.removeEventListener('mousemove', resetInactivityTimer);
      window.removeEventListener('keydown', resetInactivityTimer);
      window.removeEventListener('mousedown', resetInactivityTimer);
      window.removeEventListener('scroll', resetInactivityTimer);
      window.removeEventListener('touchstart', resetInactivityTimer);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isScreensaverActive, state.inactivityTimeout]);

  // Hook to hide the cursor after a few seconds of mouse inactivity (except when settings are open)
  useEffect(() => {
    const handleMouseMove = () => {
      setShowCursor(true);
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
      if (isSettingsOpen) {
        return;
      }
      cursorTimeoutRef.current = setTimeout(() => {
        setShowCursor(false);
      }, 3000);
    };

    handleMouseMove();

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, [isSettingsOpen]);

  // Receive sync events from socket for toggle widgets
  useEffect(() => {
    const handleSync = (syncedState) => {
      setIsScreensaverActive(syncedState.screensaverActive);
    };
    socket.on('state-sync', handleSync);
    return () => {
      socket.off('state-sync', handleSync);
    };
  }, [socket]);

  // 5. Bokeh HTML5 Canvas Particle Engine
  useEffect(() => {
    if (!state.widgets.particles || !isScreensaverActive) return;

    const canvas = particleCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;
    let particles = [];
    const particleCount = 15; // Reduced from 28 to double the CPU/GPU rendering efficiency

    const resizeCanvas = () => {
      // Downscale internal canvas resolution by 0.25x to drastically save rendering cycles.
      // High-performance upscale is handled by GPU compositor through CSS width/height: 100%.
      // This also beautifully softens and blurs the bokeh particles naturally!
      const scale = 0.25;
      canvas.width = Math.floor(window.innerWidth * scale) || 480;
      canvas.height = Math.floor(window.innerHeight * scale) || 270;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        // Since canvas is downscaled by 0.25x, a 3px-9px radius here will upscale to a gorgeous 12px-36px bokeh circle on screen
        radius: Math.random() * 6 + 3,
        // Keep motion ultra-slow, cinematic, and smooth
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        opacity: Math.random() * 0.35 + 0.1
      });
    }

    const drawParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((p) => {
        ctx.beginPath();
        // Soft glowing radial gradient for organic bokeh depth
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${p.opacity})`);
        gradient.addColorStop(0.7, `rgba(255, 255, 255, ${p.opacity * 0.35})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off bounds
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });

      animationFrameId = requestAnimationFrame(drawParticles);
    };

    drawParticles();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [state.widgets.particles, isScreensaverActive]);

  // Construct mobile remote URL
  const localIp = connectionInfo.localIps[0] || window.location.hostname;
  const remoteUrl = `http://${localIp}:${connectionInfo.port}/?mode=remote`;
  const qrCodeSrc = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&color=255-255-255&bgcolor=0-0-0&data=${encodeURIComponent(remoteUrl)}`;

  const currentThemeClass = `theme-${state.theme.toLowerCase().replace(' ', '-')}`;

  const getSingleImageStyle = (url, w, h, slideCropPercent, slideCropPositionY) => {
    let R_i = 1.5;
    if (w && h) {
      R_i = w / h;
    }
    const containerWidth = dimensions.width;
    const containerHeight = dimensions.height;
    const R_c = containerWidth / containerHeight;

    const { cropPercent: liveCropPercent, cropPositionY: liveCropPositionY } = getPhotoCropState(
      state,
      url,
      slideCropPercent,
      slideCropPositionY !== undefined ? slideCropPositionY : 50
    );
    const P_y = liveCropPositionY !== undefined ? liveCropPositionY : (slideCropPositionY !== undefined ? slideCropPositionY : 50);

    const defaultP = state.scaleMode === 'contain' ? 0 : 100;
    const P = liveCropPercent !== undefined ? liveCropPercent : defaultP;

    let wDisp, hDisp;
    if (R_i < R_c) {
      // Image is taller/narrower than the container
      const hContain = containerHeight;
      const hCover = containerWidth / R_i;
      hDisp = hContain + (hCover - hContain) * (P / 100);
      wDisp = hDisp * R_i;
    } else {
      // Image is wider/shorter than the container
      const wContain = containerWidth;
      const wCover = containerHeight * R_i;
      wDisp = wContain + (wCover - wContain) * (P / 100);
      hDisp = wDisp / R_i;
    }

    return {
      backgroundImage: `url(${url})`,
      backgroundSize: `${Math.round(wDisp)}px ${Math.round(hDisp)}px`,
      backgroundPosition: `center ${P_y}%`,
      backgroundRepeat: 'no-repeat'
    };
  };

  const getSplitImageStyle = (url, w, h, slideCropPercent, slideCropPositionY) => {
    let R_i = 0.667;
    if (w && h) {
      R_i = w / h;
    }
    const halfWidth = (dimensions.width - 48) / 2;
    const halfHeight = dimensions.height - 32;
    const R_c = halfWidth / halfHeight;

    const { cropPercent: liveCropPercent, cropPositionY: liveCropPositionY } = getPhotoCropState(
      state,
      url,
      slideCropPercent,
      slideCropPositionY !== undefined ? slideCropPositionY : 50
    );
    const P_y = liveCropPositionY !== undefined ? liveCropPositionY : (slideCropPositionY !== undefined ? slideCropPositionY : 50);

    const P = liveCropPercent !== undefined ? liveCropPercent : (state.splitCropPercent !== undefined ? state.splitCropPercent : 50);

    let wDisp, hDisp;
    if (R_i < R_c) {
      // Image is taller/narrower than the container
      const hContain = halfHeight;
      const hCover = halfWidth / R_i;
      hDisp = hContain + (hCover - hContain) * (P / 100);
      wDisp = hDisp * R_i;
    } else {
      // Image is wider/shorter than the container
      const wContain = halfWidth;
      const wCover = halfHeight * R_i;
      wDisp = wContain + (wCover - wContain) * (P / 100);
      hDisp = wDisp / R_i;
    }

    return {
      backgroundImage: `url(${url})`,
      backgroundSize: `${Math.round(wDisp)}px ${Math.round(hDisp)}px`,
      backgroundPosition: `center ${P_y}%`,
      backgroundRepeat: 'no-repeat'
    };
  };

  return (
    <div className={`lumina-tv-container ${currentThemeClass} ${showCursor ? '' : 'hide-cursor'}`}>
      {/* 1. Ambient Wallpaper Slideshow */}
      <div className="slideshow-container">
        {activeSlides.map((slide) => {
          const isSplit = slide.isSplit && state.splitPortrait;
          const currentScaleMode = state.scaleMode || 'cover';
          const shouldAnimate = state.widgets.animations && (isSplit || currentScaleMode === 'cover');

          return (
            <div
              key={slide.key}
              className={`slide ${slide.active ? 'active' : ''}`}
            >
              {isSplit ? (
                <div className="split-slide-container">
                  <div className="slide-half">
                    <div 
                      className={`slide-half-image ${shouldAnimate ? 'animated' : ''}`}
                      style={getSplitImageStyle(slide.url, slide.w, slide.h, slide.cropPercent, slide.cropPositionY)}
                    />
                    <div className="slide-half-credit">
                      <div className="title">{slide.title}</div>
                      <div className="author">by {slide.author}</div>
                    </div>
                  </div>
                  <div className="slide-half">
                    <div 
                      className={`slide-half-image ${shouldAnimate ? 'animated' : ''}`}
                      style={getSplitImageStyle(slide.url2, slide.w2, slide.h2, slide.cropPercent2, slide.cropPositionY2)}
                    />
                    <div className="slide-half-credit">
                      <div className="title">{slide.title2}</div>
                      <div className="author">by {slide.author2}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="single-slide-container">
                  <div 
                    className={`single-slide-image ${shouldAnimate ? 'animated' : ''}`}
                    style={getSingleImageStyle(slide.url, slide.w, slide.h, slide.cropPercent, slide.cropPositionY)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Preloading Overlay for seamless startup transition */}
      {activeSlides.length === 0 && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 2,
          background: '#06050b',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px'
        }}>
          <RefreshCw size={40} className="animate-spin" style={{ color: 'var(--accent-color)', opacity: 0.8 }} />
          <p style={{ fontFamily: 'Outfit', fontWeight: 300, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em' }}>
            Preloading Scenic Canvas...
          </p>
        </div>
      )}

      {/* 2. Color-Breathing Backlight Aura */}
      {state.widgets.auraglow && <div className="aura-glow-overlay" />}

      {/* 3. Bokeh Particles Canvas */}
      {state.widgets.particles && (
        <canvas ref={particleCanvasRef} className="particles-canvas" />
      )}

      {/* 4. Live Atmospheric Weather Animations */}
      {isScreensaverActive && weather && state.widgets.animations && (
        <div className="weather-overlay-effect">
          {/* Drifting Clouds effect */}
          {[1, 2, 3].includes(weather.current.weather_code) && (
            <>
              <div className="drifting-cloud" style={{ width: '40vw', height: '40vw', top: '-10%', left: '10%', animation: 'auraBreath 30s infinite alternate ease-in-out' }} />
              <div className="drifting-cloud" style={{ width: '50vw', height: '50vw', bottom: '-20%', right: '5%', animation: 'auraBreath 45s infinite alternate ease-in-out' }} />
            </>
          )}
          {/* Rainy Showers effect */}
          {[51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weather.current.weather_code) && (
            <div className="rain-container">
              {Array.from({ length: 15 }).map((_, i) => (
                <div
                  key={i}
                  className="rain-drop"
                  style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 5}s`,
                    animationDuration: `${0.8 + Math.random() * 0.7}s`
                  }}
                />
              ))}
            </div>
          )}
          {/* Snowy Flakes effect */}
          {[71, 73, 75, 77, 85, 86].includes(weather.current.weather_code) && (
            <div className="snow-container">
              {Array.from({ length: 25 }).map((_, i) => (
                <div
                  key={i}
                  className="snow-flake"
                  style={{
                    left: `${Math.random() * 100}%`,
                    width: `${Math.random() * 5 + 3}px`,
                    height: `${Math.random() * 5 + 3}px`,
                    animationDelay: `${Math.random() * 6}s`,
                    animationDuration: `${3 + Math.random() * 4}s`
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Vignette Shadow Overlay */}
      <div className="tv-vignette" />

      {/* 6. ScreensaverDimmer (Pure pitch black cover when screen is 'Active' or in use, fades out to show screensaver after inactivity) */}
      <div className={`screensaver-dimmer ${isScreensaverActive ? 'active' : ''}`} />

      {/* 7. Faint clock displayed when dimmer is active (TV in regular idle mode, shows tiny info in bottom right) */}
      {!isScreensaverActive && (
        <div className="stealth-dim-clock">
          <Clock size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          <span style={{ fontSize: '0.8rem', opacity: 0.5, marginLeft: '12px' }}>
            PRESS ANY KEY FOR SCENIC MODE
          </span>
        </div>
      )}

      {/* 8. TV Dashboard Glassmorphic UI overlays */}
      {isScreensaverActive && (
        <div className="tv-dashboard-ui">
          {/* A. Time & Date (Top Left) */}
          {state.widgets.clock && (
            <div className="glass-widget clock-widget">
              <div className="clock-time">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).split(' ')[0]}
                <span style={{ fontSize: '1.4rem', fontWeight: 300, opacity: 0.7, marginLeft: '8px' }}>
                  {currentTime.toLocaleTimeString([], { hour12: true }).split(' ')[1]}
                </span>
              </div>
              <div className="clock-date">
                {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
            </div>
          )}

          {/* B. Live Weather Forecast widget (Top Right) */}
          {state.widgets.weather && weather && (
            <div className="glass-widget weather-widget">
              <div className="weather-main">
                <div className="weather-temp-row">
                  <span className="weather-temp">
                    {Math.round(weather.current.temperature_2m)}°C
                  </span>
                  <span className="weather-icon-wrapper">
                    {getWeatherInfo(weather.current.weather_code).icon}
                  </span>
                </div>
                <div className="weather-condition">
                  {getWeatherInfo(weather.current.weather_code).text}
                </div>
                <div className="weather-humidity">
                  <Droplets size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', opacity: 0.8 }} />
                  {weather.current.relative_humidity_2m}% Humidity
                </div>
                <div className="weather-city">
                  <MapPin size={10} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  {weather.location.city}, {weather.location.regionName}
                </div>
              </div>
              <div className="weather-divider" />
              <div className="weather-forecast">
                {weather.daily.time.slice(1, 4).map((time, idx) => {
                  const dayName = new Date(time).toLocaleDateString([], { weekday: 'short' });
                  const tempMax = Math.round(weather.daily.temperature_2m_max[idx + 1]);
                  const tempMin = Math.round(weather.daily.temperature_2m_min[idx + 1]);
                  const info = getWeatherInfo(weather.daily.weather_code[idx + 1]);
                  return (
                    <div key={idx} className="forecast-day">
                      <span className="forecast-day-name">{dayName}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {info.icon}
                        <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>{info.text}</span>
                      </span>
                      <span>{tempMax}° / {tempMin}°</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* C. Mobile Remote portal (Bottom Left) */}
          <div className="glass-widget connection-widget">
            <img src={qrCodeSrc} alt="Link QR Code" className="qr-code-img" />
            <div className="connection-info">
              <span className="connection-title">Remote Control</span>
              <span className="connection-ip">{localIp}:{connectionInfo.port}</span>
            </div>
          </div>

          {/* D. Wallpaper Credits widget (Bottom Right) */}
          {activeSlides.find(s => s.active) && !activeSlides.find(s => s.active).isSplit && (
            <div className="glass-widget photo-info-widget">
              <span className="photo-category">
                {activeSlides.find(s => s.active).category ? activeSlides.find(s => s.active).category.split(',').join(' + ') : ''}
              </span>
              <div className="photo-title">
                {activeSlides.find(s => s.active).title}
              </div>
              <div className="photo-author">
                by {activeSlides.find(s => s.active).author}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 9. Floating Settings Button & Drawer (only pointer-events allowed on hover/click) */}
      {isScreensaverActive && (
        <>
          <button 
            className="desktop-settings-btn"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            title="Quick Settings"
          >
            {isSettingsOpen ? <X size={20} /> : <Settings size={20} />}
          </button>

          <div className={`desktop-settings-drawer ${isSettingsOpen ? 'open' : ''}`}>
            <div className="desktop-settings-header">
              <span className="desktop-settings-title">Lumina Settings</span>
              <button className="desktop-settings-close" onClick={() => setIsSettingsOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Section 1: Slideshow Speed */}
            <div className="desktop-settings-section">
              <span className="desktop-settings-section-title">Slideshow Speed</span>
              <div className="desktop-settings-grid">
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
                      className={`desktop-settings-btn-option ${isActive ? 'active' : ''}`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Active Image Feed */}
            <div className="desktop-settings-section">
              <span className="desktop-settings-section-title">Visual Feed</span>
              <div className="desktop-settings-list">
                {([...Object.keys(state.searchKeywords || {}), 'Google Photos']).map((cat) => {
                  const isActive = state.currentCategory ? state.currentCategory.split(',').includes(cat) : false;
                  return (
                    <div
                      key={cat}
                      onClick={() => {
                        const currentCats = state.currentCategory ? state.currentCategory.split(',') : [];
                        let newCats;
                        if (currentCats.includes(cat)) {
                          if (currentCats.length > 1) {
                            newCats = currentCats.filter(c => c !== cat);
                          } else {
                            newCats = currentCats;
                          }
                        } else {
                          newCats = [...currentCats, cat];
                        }
                        socket.emit('change-category', newCats.join(','));
                      }}
                      className={`desktop-settings-item ${isActive ? 'active' : ''}`}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>
                          {cat === 'Scenic Nature' ? '⛰️' :
                           cat === 'Cosmic Space' ? '✨' :
                           cat === 'Abstract Art' ? '🎨' :
                           cat === 'Liminal Spaces' ? '🚪' :
                           cat === 'AI Creations' ? '🤖' :
                           cat === 'Google Photos' ? '📸' : '🖼️'}
                        </span>
                        <span>{cat} Feed</span>
                      </span>
                      {isActive && <Check size={14} style={{ color: 'var(--accent-color)' }} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Mood Themes */}
            <div className="desktop-settings-section">
              <span className="desktop-settings-section-title">Mood Theme</span>
              <div className="desktop-settings-list">
                {['Zen Retreat', 'Cosmic Night', 'Art Museum', 'Cyberpunk Rain'].map((t) => {
                  const isActive = state.theme === t;
                  return (
                    <div
                      key={t}
                      onClick={() => socket.emit('change-theme', t)}
                      className={`desktop-settings-item ${isActive ? 'active' : ''}`}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>
                          {t === 'Zen Retreat' && '🌿'}
                          {t === 'Cosmic Night' && '🪐'}
                          {t === 'Art Museum' && '🏛️'}
                          {t === 'Cyberpunk Rain' && '🌧️'}
                        </span>
                        <span>{t}</span>
                      </span>
                      {isActive && <Check size={14} style={{ color: 'var(--accent-color)' }} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 4: Toggle Overlays */}
            <div className="desktop-settings-section">
              <span className="desktop-settings-section-title">Toggle Widgets</span>
              <div className="desktop-settings-list">
                {[
                  { label: 'Cinematic Clock', name: 'clock' },
                  { label: 'Live Weather Info', name: 'weather' },
                  { label: 'Particles Engine', name: 'particles' },
                  { label: 'Atmospheric Aura Glow', name: 'auraglow' },
                  { label: 'Cinematic Pan & Zoom', name: 'animations' }
                ].map((widget) => {
                  const visible = state.widgets[widget.name];
                  return (
                    <div
                      key={widget.name}
                      onClick={() => socket.emit('toggle-widget', { widgetName: widget.name, visible: !visible })}
                      className={`desktop-settings-item ${visible ? 'active' : ''}`}
                    >
                      <span>{widget.label}</span>
                      <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{visible ? 'ON' : 'OFF'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 4.5: Display & Layout */}
            <div className="desktop-settings-section">
              <span className="desktop-settings-section-title">Display & Layout</span>
              <div className="desktop-settings-list">
                <div
                  onClick={() => socket.emit('change-scale-mode', state.scaleMode === 'contain' ? 'cover' : 'contain')}
                  className={`desktop-settings-item ${state.scaleMode === 'contain' ? 'active' : ''}`}
                >
                  <span>Fit to Screen (Contain)</span>
                  <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{state.scaleMode === 'contain' ? 'ON' : 'OFF'}</span>
                </div>
                <div
                  onClick={() => socket.emit('toggle-split-portrait', !state.splitPortrait)}
                  className={`desktop-settings-item ${state.splitPortrait ? 'active' : ''}`}
                >
                  <span>Split Portrait Display</span>
                  <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{state.splitPortrait ? 'ON' : 'OFF'}</span>
                </div>
                {state.splitPortrait && (
                  <div style={{ padding: '10px 14px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '8px', margin: '4px 0', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', opacity: 0.7, marginBottom: '6px' }}>
                      <span>Split Crop/Zoom Balance</span>
                      <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{state.splitCropPercent !== undefined ? state.splitCropPercent : 50}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={state.splitCropPercent !== undefined ? state.splitCropPercent : 50}
                      onChange={(e) => socket.emit('change-split-crop', parseInt(e.target.value))}
                      style={{ width: '100%' }}
                      className="split-crop-slider"
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', opacity: 0.4, marginTop: '4px' }}>
                      <span>Fit (0%)</span>
                      <span>Fill (100%)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Section 5: Environmental Smart Alignment */}
            <div className="desktop-settings-section">
              <span className="desktop-settings-section-title">Atmospheric Alignment</span>
              <div className="desktop-settings-list">
                <div
                  onClick={() => socket.emit('toggle-align-time', !state.alignTimeOfDay)}
                  className={`desktop-settings-item ${state.alignTimeOfDay ? 'active' : ''}`}
                >
                  <span>Align with Time of Day</span>
                  <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{state.alignTimeOfDay ? 'ON' : 'OFF'}</span>
                </div>

                {state.alignTimeOfDay && (
                  <div style={{ padding: '10px 14px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '8px', margin: '4px 0', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', opacity: 0.7, marginBottom: '6px' }}>
                      <span>Night/Evening Photo ratio</span>
                      <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{state.nightPercentage || 50}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={state.nightPercentage || 50}
                      onChange={(e) => socket.emit('change-night-percentage', parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--accent-color)', cursor: 'pointer', height: '4px', border: 'none', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}
                    />
                  </div>
                )}

                <div
                  onClick={() => socket.emit('toggle-align-weather', !state.alignWeather)}
                  className={`desktop-settings-item ${state.alignWeather ? 'active' : ''}`}
                >
                  <span>Weather & News Alignment</span>
                  <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{state.alignWeather ? 'ON' : 'OFF'}</span>
                </div>

                {state.alignWeather && (
                  <>
                    <div
                      onClick={() => socket.emit('toggle-allow-openai-fallback', !state.allowOpenAiFallback)}
                      className={`desktop-settings-item ${state.allowOpenAiFallback ? 'active' : ''}`}
                      style={{ marginLeft: '12px', opacity: 0.95, borderLeft: '2px solid rgba(255,255,255,0.1)' }}
                    >
                      <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.8rem' }}>Allow OpenAI Fallback</span>
                        <span style={{ fontSize: '0.65rem', opacity: 0.4, color: '#f87171', lineHeight: '1.2', maxWidth: '300px' }}>
                          ⚠️ Warning: Will query OpenAI API if Poochy vision fails
                        </span>
                      </span>
                      <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{state.allowOpenAiFallback ? 'ON' : 'OFF'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;
