import { useState } from 'react';
import {
  DEFAULT_SWIPE_STATUS,
  classifySwipe,
  getTriggeredSwipeStatus,
  getTouchClientX
} from '../state/swipeGesture';

export function useSwipeGesture(actions) {
  const [touchStartX, setTouchStartX] = useState(0);
  const [swipeStatus, setSwipeStatus] = useState(DEFAULT_SWIPE_STATUS);

  const handleTouchStart = (e) => {
    const startX = getTouchClientX(e.touches);
    if (startX !== null) {
      setTouchStartX(startX);
    }
  };

  const handleTouchEnd = (e) => {
    const touchEndX = getTouchClientX(e.changedTouches);
    const swipe = classifySwipe(touchStartX, touchEndX);
    if (swipe) {
      if (swipe.direction === 'next') {
        actions.triggerNext();
      } else {
        actions.triggerPrev();
      }
      setSwipeStatus(swipe.status);
      setTimeout(() => {
        setSwipeStatus(DEFAULT_SWIPE_STATUS);
      }, 2000);
    }
  };

  const triggerNext = () => {
    actions.triggerNext();
    setSwipeStatus(getTriggeredSwipeStatus('next'));
    setTimeout(() => setSwipeStatus(DEFAULT_SWIPE_STATUS), 1500);
  };

  const triggerPrev = () => {
    actions.triggerPrev();
    setSwipeStatus(getTriggeredSwipeStatus('previous'));
    setTimeout(() => setSwipeStatus(DEFAULT_SWIPE_STATUS), 1500);
  };

  return {
    swipeStatus,
    handleTouchStart,
    handleTouchEnd,
    triggerNext,
    triggerPrev
  };
}
