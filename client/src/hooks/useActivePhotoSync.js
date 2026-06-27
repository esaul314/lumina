import { useState, useEffect } from 'react';

export function useActivePhotoSync(state, remoteDimensionsCache, remoteOrientationCache) {
  const [activePhotoOrientation, setActivePhotoOrientation] = useState('landscape');
  const [localSecondPhoto, setLocalSecondPhoto] = useState(null);

  useEffect(() => {
    let active = true;
    if (!state.activePhoto) {
      setActivePhotoOrientation('landscape');
      setLocalSecondPhoto(null);
      return;
    }

    const checkActivePhoto = () => {
      const activeUrl = state.activePhoto.url;
      const cached = remoteOrientationCache.current[activeUrl];

      const processActiveOrientation = (isPortrait, dimensions = remoteDimensionsCache.current[activeUrl]) => {
        if (!active) return;
        setActivePhotoOrientation(isPortrait ? 'portrait' : 'landscape');
        setLocalSecondPhoto(state.currentFrame?.secondary || state.activeSecondPhoto || null);

        if (dimensions) {
          remoteDimensionsCache.current[activeUrl] = dimensions;
        }
      };

      const cachedDims = remoteDimensionsCache.current[activeUrl];
      if (cached && cachedDims) {
        processActiveOrientation(cached === 'portrait', cachedDims);
      } else {
        const img = new window.Image();
        img.onload = () => {
          if (!active) return;
          const isPortrait = img.naturalHeight > img.naturalWidth;
          remoteOrientationCache.current[activeUrl] = isPortrait ? 'portrait' : 'landscape';
          remoteDimensionsCache.current[activeUrl] = {
            w: img.naturalWidth,
            h: img.naturalHeight
          };
          processActiveOrientation(isPortrait, remoteDimensionsCache.current[activeUrl]);
        };
        img.onerror = () => {
          if (!active) return;
          remoteOrientationCache.current[activeUrl] = 'landscape';
          processActiveOrientation(false);
        };
        img.src = activeUrl;
      }
    };

    checkActivePhoto();
    return () => {
      active = false;
    };
  }, [state.activePhoto?.url, state.currentFrame?.secondary?.url, state.activeSecondPhoto?.url, remoteDimensionsCache, remoteOrientationCache]);

  return {
    activePhotoOrientation,
    localSecondPhoto,
    setLocalSecondPhoto
  };
}
