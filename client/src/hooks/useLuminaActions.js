import { useMemo } from 'react';
import {
  getStateSnapshot,
  nextPhoto,
  patchPhoto,
  previewPhoto,
  prevPhoto
} from '../api/luminaClient';
import { normalizeSnapshot, patchPhotoInSnapshot } from '../state/frameSelectors';

export function useLuminaActions(socket, setState) {
  const refreshState = async () => {
    const snapshot = await getStateSnapshot();
    setState(normalizeSnapshot(snapshot));
  };

  const applyPhotoPatch = (url, patch) => {
    setState((current) => patchPhotoInSnapshot(current, url, patch));
  };

  const runPhotoAction = async (action, fallback = null) => {
    try {
      await action();
    } catch (error) {
      console.error('[LuminaActions] Photo action failed:', error);
      if (typeof fallback === 'function') {
        fallback();
      }
    }
  };

  return useMemo(() => ({
    setPhotoCrop: (url, cropPercent, cropPositionY) => {
      void runPhotoAction(async () => {
        await patchPhoto({ url, cropPercent, cropPositionY });
        applyPhotoPatch(url, {
          ...(cropPercent !== undefined ? { cropPercent } : {}),
          ...(cropPositionY !== undefined ? { cropPositionY } : {})
        });
      });
    },
    setPreventPairing: (url, preventPairing, options = {}) => {
      void runPhotoAction(async () => {
        await patchPhoto({ url, preventPairing, preserveActive: options.preserveActive });
        if (options.preserveActive && preventPairing) {
          await refreshState();
          return;
        }
        applyPhotoPatch(url, { preventPairing });
      });
    },
    ratePhoto: (url, rating) => {
      void runPhotoAction(async () => {
        await patchPhoto({ url, rating });
        if (rating === 1) {
          await refreshState();
          return;
        }
        applyPhotoPatch(url, { rating });
      });
    },
    setActivePhoto: (photo) => {
      void runPhotoAction(async () => {
        await previewPhoto(photo);
        await refreshState();
      });
    },
    updateFeedConfig: (category, source, config) => {
      socket.emit('update-feed-config', { category, source, config });
    },
    changeInterval: (interval) => {
      socket.emit('change-interval', interval);
    },
    toggleWidget: (widgetName, visible) => {
      socket.emit('toggle-widget', { widgetName, visible });
    },
    changeTheme: (themeName) => {
      socket.emit('change-theme', themeName);
    },
    changeCategory: (categoriesStr) => {
      socket.emit('change-category', categoriesStr);
    },
    addCategory: (category, keyword) => {
      socket.emit('add-category', { category, keyword });
    },
    deleteCategory: (category) => {
      socket.emit('delete-category', { category });
    },
    setScreensaverActive: (active) => {
      socket.emit('set-screensaver-active', active);
    },
    triggerNext: () => {
      void runPhotoAction(async () => {
        await nextPhoto();
        await refreshState();
      });
    },
    triggerPrev: () => {
      void runPhotoAction(async () => {
        await prevPhoto();
        await refreshState();
      });
    },
    markPhotoBroken: (url) => {
      void runPhotoAction(async () => {
        await patchPhoto({ url, isBroken: true });
        await refreshState();
      });
    },
    changeScaleMode: (mode) => {
      socket.emit('change-scale-mode', mode);
    },
    toggleSplitPortrait: (split) => {
      socket.emit('toggle-split-portrait', split);
    },
    changeSplitCrop: (percent) => {
      socket.emit('change-split-crop', percent);
    },
    toggleAlignTime: (align) => {
      socket.emit('toggle-align-time', align);
    },
    changeNightPercentage: (percent) => {
      socket.emit('change-night-percentage', percent);
    },
    toggleAlignWeather: (align) => {
      socket.emit('toggle-align-weather', align);
    },
    updateVisionConfig: (config) => {
      socket.emit('update-vision-config', config);
    },
    toggleAllowOpenAiFallback: (allow) => {
      socket.emit('toggle-allow-openai-fallback', allow);
    },
    toggleAutoLocation: (auto) => {
      socket.emit('toggle-auto-location', auto);
    },
    updateManualLocation: (location) => {
      socket.emit('update-manual-location', location);
    },
    updateExcludedKeywords: (keywords) => {
      socket.emit('update-excluded-keywords', keywords);
    },
    triggerRecrawl: () => {
      socket.emit('trigger-recrawl');
    },
    saveUseapiToken: (token) => {
      socket.emit('save-useapi-token', { token });
    }
  }), [setState, socket]);
}
