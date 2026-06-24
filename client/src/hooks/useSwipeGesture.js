import { useState } from 'react';

export function useSwipeGesture(actions) {
  const [touchStartX, setTouchStartX] = useState(0);
  const [swipeStatus, setSwipeStatus] = useState('Swipe left or right to change photo');

  const handleTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      setTouchStartX(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = (e) => {
    if (!e.changedTouches || !e.changedTouches[0]) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX - touchEndX;

    // Minimum swipe threshold (50px)
    if (Math.abs(diffX) > 50) {
      if (diffX > 0) {
        actions.triggerNext();
        setSwipeStatus('Swiped Left: Next Photo');
      } else {
        actions.triggerPrev();
        setSwipeStatus('Swiped Right: Previous Photo');
      }
      
      setTimeout(() => {
        setSwipeStatus('Swipe left or right to change photo');
      }, 2000);
    }
  };

  const triggerNext = () => {
    actions.triggerNext();
    setSwipeStatus('Next Photo Triggered');
    setTimeout(() => setSwipeStatus('Swipe left or right to change photo'), 1500);
  };

  const triggerPrev = () => {
    actions.triggerPrev();
    setSwipeStatus('Previous Photo Triggered');
    setTimeout(() => setSwipeStatus('Swipe left or right to change photo'), 1500);
  };

  return {
    swipeStatus,
    handleTouchStart,
    handleTouchEnd,
    triggerNext,
    triggerPrev
  };
}
