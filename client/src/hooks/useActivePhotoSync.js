import { useState, useEffect } from 'react';
import { getCurrentFrame, getFrameOrientation } from '../state/frameSelectors';

export function useActivePhotoSync(state, remoteDimensionsCache, remoteOrientationCache) {
  const [activePhotoOrientation, setActivePhotoOrientation] = useState('landscape');

  useEffect(() => {
    const frame = getCurrentFrame(state);
    const activePhoto = frame.primary || state.activePhoto;
    const frameOrientation = getFrameOrientation(state);
    let active = true;
    if (!activePhoto) {
      setActivePhotoOrientation('landscape');
      return;
    }

    const checkActivePhoto = () => {
      const activeUrl = activePhoto.url;
      const cached = remoteOrientationCache.current[activeUrl];

      const processActiveOrientation = (isPortrait, dimensions = remoteDimensionsCache.current[activeUrl]) => {
        if (!active) return;
        setActivePhotoOrientation(isPortrait ? 'portrait' : 'landscape');

        if (dimensions) {
          remoteDimensionsCache.current[activeUrl] = dimensions;
        }
      };

      if (frameOrientation === 'portrait' || frameOrientation === 'landscape') {
        processActiveOrientation(frameOrientation === 'portrait');
        return;
      }

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
  }, [state.currentFrame?.primary?.url, state.currentFrame?.context?.orientation, remoteDimensionsCache, remoteOrientationCache]);

  return {
    activePhotoOrientation
  };
}
