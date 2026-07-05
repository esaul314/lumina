import { useMemo } from 'react';
import {
  createPool,
  deletePool,
  getStateSnapshot,
  nextPhoto,
  patchPool,
  patchPoolFeedSource,
  patchState,
  patchPhoto,
  previewPhoto,
  prevPhoto,
  selectCategories,
  setScreensaverActive
} from '../api/luminaClient';
import { normalizeSnapshot, patchPhotoInSnapshot } from '../state/frameSelectors';
import {
  applyCategorySelection,
  applyFeedSourceConfigPatch,
  serializeCategorySelection
} from '../state/feedMutations';

export function useLuminaActions(socket, setState) {
  const refreshState = async () => {
    const snapshot = await getStateSnapshot();
    setState(normalizeSnapshot(snapshot));
  };

  const applySnapshotPatch = (updater) => {
    setState((current) => (current ? updater(current) : current));
  };

  const applyPhotoPatch = (url, patch) => {
    setState((current) => patchPhotoInSnapshot(current, url, patch));
  };

  const applyStateResponse = (nextState) => {
    if (nextState) {
      setState(normalizeSnapshot(nextState.state || nextState));
    }
  };

  const runAction = async (action, fallback = null) => {
    try {
      await action();
    } catch (error) {
      console.error('[LuminaActions] Action failed:', error);
      if (typeof fallback === 'function') {
        fallback();
      }
    }
  };

  return useMemo(() => ({
    setPhotoCrop: (url, cropPercent, cropPositionY) => {
      void runAction(async () => {
        await patchPhoto({ url, cropPercent, cropPositionY });
        applyPhotoPatch(url, {
          ...(cropPercent !== undefined ? { cropPercent } : {}),
          ...(cropPositionY !== undefined ? { cropPositionY } : {})
        });
      });
    },
    setPreventPairing: (url, preventPairing, options = {}) => {
      void runAction(async () => {
        await patchPhoto({ url, preventPairing, preserveActive: options.preserveActive });
        if (options.preserveActive && preventPairing) {
          await refreshState();
          return;
        }
        applyPhotoPatch(url, { preventPairing });
      });
    },
    ratePhoto: (url, rating) => {
      void runAction(async () => {
        await patchPhoto({ url, rating });
        if (rating === 1) {
          await refreshState();
          return;
        }
        applyPhotoPatch(url, { rating });
      });
    },
    setActivePhoto: (photo) => {
      void runAction(async () => {
        await previewPhoto(photo);
        await refreshState();
      });
    },
    updateFeedConfig: (category, source, config) => {
      void runAction(async () => {
        applySnapshotPatch((current) => applyFeedSourceConfigPatch(current, category, source, config));
        await patchPoolFeedSource(category, source, config);
        await refreshState();
      }, refreshState);
    },
    changeInterval: (interval) => {
      void runAction(async () => {
        const nextState = await patchState({ slideshowInterval: interval });
        applyStateResponse(nextState);
      });
    },
    toggleWidget: (widgetName, visible) => {
      void runAction(async () => {
        const nextState = await patchState({
          widgets: { [widgetName]: visible }
        });
        applyStateResponse(nextState);
      });
    },
    changeTheme: (themeName) => {
      void runAction(async () => {
        const nextState = await patchState({ theme: themeName });
        applyStateResponse(nextState);
      });
    },
    changeCategory: (categoriesStr) => {
      const categories = serializeCategorySelection(categoriesStr);
      if (!categories) {
        return;
      }

      void runAction(async () => {
        applySnapshotPatch((current) => applyCategorySelection(current, categories));
        const nextState = await selectCategories(categories, { socket });
        if (nextState) {
          applyStateResponse(nextState);
        }
      }, refreshState);
    },
    addCategory: (category, keyword) => {
      void runAction(async () => {
        await createPool({ name: category, keywords: keyword });
        await refreshState();
      });
    },
    deleteCategory: (category) => {
      void runAction(async () => {
        await deletePool(category);
        await refreshState();
      });
    },
    updatePoolKeywords: (category, keywords) => {
      void runAction(async () => {
        await patchPool(category, { keywords });
        await refreshState();
      });
    },
    setScreensaverActive: (active) => {
      void runAction(async () => {
        const nextState = await setScreensaverActive(active);
        applyStateResponse(nextState);
      });
    },
    triggerNext: () => {
      void runAction(async () => {
        await nextPhoto();
        await refreshState();
      });
    },
    triggerPrev: () => {
      void runAction(async () => {
        await prevPhoto();
        await refreshState();
      });
    },
    markPhotoBroken: (url) => {
      void runAction(async () => {
        await patchPhoto({ url, isBroken: true });
        await refreshState();
      });
    },
    changeScaleMode: (mode) => {
      void runAction(async () => {
        const nextState = await patchState({ scaleMode: mode });
        applyStateResponse(nextState);
      });
    },
    toggleSplitPortrait: (split) => {
      void runAction(async () => {
        const nextState = await patchState({ splitPortrait: split });
        applyStateResponse(nextState);
      });
    },
    changeSplitCrop: (percent) => {
      void runAction(async () => {
        const nextState = await patchState({ splitCropPercent: percent });
        applyStateResponse(nextState);
      });
    },
    toggleAlignTime: (align) => {
      void runAction(async () => {
        const nextState = await patchState({ alignTimeOfDay: align });
        applyStateResponse(nextState);
      });
    },
    changeNightPercentage: (percent) => {
      void runAction(async () => {
        const nextState = await patchState({ nightPercentage: percent });
        applyStateResponse(nextState);
      });
    },
    toggleAlignWeather: (align) => {
      void runAction(async () => {
        const nextState = await patchState({ alignWeather: align });
        applyStateResponse(nextState);
      });
    },
    updateVisionConfig: (config) => {
      void runAction(async () => {
        const nextState = await patchState({ visionConfig: config });
        applyStateResponse(nextState);
      });
    },
    toggleAllowOpenAiFallback: (allow) => {
      void runAction(async () => {
        const nextState = await patchState({ allowOpenAiFallback: allow });
        applyStateResponse(nextState);
      });
    },
    toggleAutoLocation: (auto) => {
      void runAction(async () => {
        const nextState = await patchState({ autoLocation: auto });
        applyStateResponse(nextState);
      });
    },
    updateManualLocation: (location) => {
      void runAction(async () => {
        const nextState = await patchState({ manualLocation: location });
        applyStateResponse(nextState);
      });
    },
    updateExcludedKeywords: (keywords) => {
      void runAction(async () => {
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
