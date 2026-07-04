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
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      setImageStatus('loaded');
      remoteDimensionsCache.current[url] = { w: width, h: height };
      remoteOrientationCache.current[url] = height > width ? 'portrait' : 'landscape';
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
