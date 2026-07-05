import { useMemo } from 'react';
import {
  getStateSnapshot,
  nextPhoto,
  patchState,
  patchPhoto,
  previewPhoto,
  prevPhoto,
  setScreensaverActive
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

  const applyStateResponse = (nextState) => {
    if (nextState) {
      setState(normalizeSnapshot(nextState.state || nextState));
    }
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
      void runPhotoAction(async () => {
        const nextState = await patchState({ slideshowInterval: interval });
        applyStateResponse(nextState);
      });
    },
    toggleWidget: (widgetName, visible) => {
      void runPhotoAction(async () => {
        const nextState = await patchState({
          widgets: { [widgetName]: visible }
        });
        applyStateResponse(nextState);
      });
    },
    changeTheme: (themeName) => {
      void runPhotoAction(async () => {
        const nextState = await patchState({ theme: themeName });
        applyStateResponse(nextState);
      });
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
      void runPhotoAction(async () => {
        const nextState = await setScreensaverActive(active);
        applyStateResponse(nextState);
      });
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
      void runPhotoAction(async () => {
        const nextState = await patchState({ scaleMode: mode });
        applyStateResponse(nextState);
      });
    },
    toggleSplitPortrait: (split) => {
      void runPhotoAction(async () => {
        const nextState = await patchState({ splitPortrait: split });
        applyStateResponse(nextState);
      });
    },
    changeSplitCrop: (percent) => {
      void runPhotoAction(async () => {
        const nextState = await patchState({ splitCropPercent: percent });
        applyStateResponse(nextState);
      });
    },
    toggleAlignTime: (align) => {
      void runPhotoAction(async () => {
        const nextState = await patchState({ alignTimeOfDay: align });
        applyStateResponse(nextState);
      });
    },
    changeNightPercentage: (percent) => {
      void runPhotoAction(async () => {
        const nextState = await patchState({ nightPercentage: percent });
        applyStateResponse(nextState);
      });
    },
    toggleAlignWeather: (align) => {
      void runPhotoAction(async () => {
        const nextState = await patchState({ alignWeather: align });
        applyStateResponse(nextState);
      });
    },
    updateVisionConfig: (config) => {
      void runPhotoAction(async () => {
        const nextState = await patchState({ visionConfig: config });
        applyStateResponse(nextState);
      });
    },
    toggleAllowOpenAiFallback: (allow) => {
      void runPhotoAction(async () => {
        const nextState = await patchState({ allowOpenAiFallback: allow });
        applyStateResponse(nextState);
      });
    },
    toggleAutoLocation: (auto) => {
      void runPhotoAction(async () => {
        const nextState = await patchState({ autoLocation: auto });
        applyStateResponse(nextState);
      });
    },
    updateManualLocation: (location) => {
      void runPhotoAction(async () => {
        const nextState = await patchState({ manualLocation: location });
        applyStateResponse(nextState);
      });
    },
    updateExcludedKeywords: (keywords) => {
      void runPhotoAction(async () => {
        const nextState = await patchState({ excludedKeywords: keywords });
        applyStateResponse(nextState);
      });
    },
    triggerRecrawl: () => {
      socket.emit('trigger-recrawl');
    },
    saveUseapiToken: (token) => {
      socket.emit('save-useapi-token', { token });
    }
  }), [setState, socket]);
}
