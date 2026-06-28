import { useState, useEffect, useRef } from 'react';
import { findPhotoByUrl, getFramePhoto } from '../state/frameSelectors';

export function useCropDrag(actions, state, previewDimensions) {
  const [dragState, setDragState] = useState({
    isDragging: false,
    startY: 0,
    startCropY: 50,
    photoUrl: null,
    isSecond: false
  });
  const [currentDragY, setCurrentDragY] = useState(null);
  const cropTimeoutRef = useRef(null);

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
    
    const photoObj = isSecond
      ? findPhotoByUrl(state, photoUrl, getFramePhoto(state, 'secondary'))
      : findPhotoByUrl(state, photoUrl, getFramePhoto(state, 'primary'));
    
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

      const containerHeight = previewDimensions.height || 180;
      const sensitivity = 0.8;
      const deltaPercent = (deltaY / containerHeight) * 100 * sensitivity;

      let newCropY = Math.round(dragState.startCropY - deltaPercent);
      newCropY = Math.max(0, Math.min(100, newCropY));

      setCurrentDragY(newCropY);

      if (cropTimeoutRef.current) {
        clearTimeout(cropTimeoutRef.current);
      }

      cropTimeoutRef.current = setTimeout(() => {
        actions.setPhotoCrop(dragState.photoUrl, undefined, newCropY);
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
  }, [dragState, previewDimensions.height, actions]);

  return {
    dragState,
    currentDragY,
    handleDragStart
  };
}
