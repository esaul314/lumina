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
      
      const processActiveOrientation = (isPortrait) => {
        if (!active) return;
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
            if (active) {
              setLocalSecondPhoto(cachedPortraits[Math.floor(Math.random() * cachedPortraits.length)]);
            }
          } else {
            // Find candidates in the same category
            const candidates = state.photosList.filter(p => 
              p.url !== activeUrl && 
              remoteOrientationCache.current[p.url] !== 'landscape' &&
              p.preventPairing !== true &&
              (p.category && state.activePhoto.category && p.category === state.activePhoto.category)
            ).slice(0, 8);
            
            const findSecondSequentially = (index) => {
              if (!active) return;
              if (index >= candidates.length) {
                setLocalSecondPhoto(null);
                return;
              }
              const cand = candidates[index];
              const cImg = new window.Image();
              cImg.onload = () => {
                if (!active) return;
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
                if (!active) return;
                remoteOrientationCache.current[cand.url] = 'landscape';
                findSecondSequentially(index + 1);
              };
              cImg.src = cand.url;
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
        img.onload = () => {
          if (!active) return;
          const isPortrait = img.naturalHeight > img.naturalWidth;
          remoteOrientationCache.current[activeUrl] = isPortrait ? 'portrait' : 'landscape';
          remoteDimensionsCache.current[activeUrl] = {
            w: img.naturalWidth,
            h: img.naturalHeight
          };
          processActiveOrientation(isPortrait);
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
  }, [state.activePhoto?.url, state.activePhoto?.preventPairing, state.splitPortrait, state.photosList, remoteDimensionsCache, remoteOrientationCache]);

  return {
    activePhotoOrientation,
    localSecondPhoto,
    setLocalSecondPhoto
  };
}
