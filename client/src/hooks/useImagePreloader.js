import { useState, useEffect } from 'react';

export function useImagePreloader(url, actions, remoteDimensionsCache, remoteOrientationCache) {
  const [imageStatus, setImageStatus] = useState('loading');

  useEffect(() => {
    if (!url) return;

    let active = true;
    setImageStatus('loading');
    const img = new window.Image();
    
    // Set event handlers BEFORE setting src to prevent race conditions with cached images
    img.onload = () => {
      if (!active) return;
      setImageStatus('loaded');
      remoteDimensionsCache.current[url] = { w: img.width, h: img.height };
      remoteOrientationCache.current[url] = img.height > img.width ? 'portrait' : 'landscape';
    };

    img.onerror = () => {
      if (!active) return;
      setImageStatus('failed');
      console.warn(`[Image Preloader] Failed to load image URL: ${url}`);
      actions.markPhotoBroken(url);
    };

    img.src = url;

    return () => {
      active = false;
    };
  }, [url, actions, remoteDimensionsCache, remoteOrientationCache]);

  return { imageStatus, setImageStatus };
}
