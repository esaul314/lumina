// @ts-check

const googlePhotos = require('./services/googlePhotos.js');
const {
  saveCuratedCollections,
  updatePhotoCrop,
  updatePhotoPreventPairing,
  updatePhotoRating,
  markPhotoBroken
} = require('./config/collections.js');
const { persistEnvVars } = require('./config/env.js');
const { STATE_PATCH_FIELDS } = require('./domain/commands.js');

const CATEGORY_ALIASES = {
  'Liminal Space': 'Liminal Spaces',
  'Liminal Spaces': 'Liminal Spaces',
  'AI Creation': 'AI Creations',
  'AI Creations': 'AI Creations'
};

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const splitCategories = (categories = '') => categories.split(',').map((category) => category.trim()).filter(Boolean);
const normalizeSocketCategories = (categories) => splitCategories(categories).map((name) => CATEGORY_ALIASES[name] ?? name);
const normalizeKeywordList = (keywords = []) => keywords.map((keyword) => String(keyword).trim()).filter(Boolean);
const pickRandomPhoto = (photos) => photos[Math.floor(Math.random() * photos.length)] ?? null;
const buildDefinedMetadataPatch = (entries) => Object.fromEntries(
  Object.entries(entries).filter(([, value]) => value !== undefined)
);
const syncActivePhoto = ({ io, state }, photo) => {
  state.activePhoto = photo;
  io.emit('photo-update', state.activePhoto);
};
const buildDefaultPoolFeedConfig = (keywords) => ({
  unsplash: { enabled: true, keywords: [...keywords] },
  wallhaven: { enabled: true, keywords: [...keywords] },
  metmuseum: { enabled: true, keywords: [...keywords] },
  artic: { enabled: false, keywords: [...keywords] }
});

function createSocketLegacyCompatibility({
  io,
  state,
  collections,
  combineFeedsBalanced,
  getSmartPhoto,
  launchKioskBrowser,
  killKioskBrowser,
  setManualOverride,
  triggerWeatherUpdate,
  broadcast
}) {
  const applyGooglePhotoMetadata = ({ url, metadata, afterApply }) => {
    if (!googlePhotos.isGooglePhotoProxyUrl(url)) {
      return false;
    }

    const metadataPatch = googlePhotos.buildGooglePhotoMetadataPatch(metadata);
    if (Object.keys(metadataPatch).length === 0) {
      return false;
    }

    const updatedPhoto = googlePhotos.updateCachedMediaItemMetadata(url, metadataPatch);
    if (!updatedPhoto) {
      return false;
    }

    googlePhotos.applyCachedMediaItemMetadataToState(state, url, metadataPatch);
    afterApply?.(updatedPhoto);
    broadcast();
    return true;
  };

  const createPhotoMutationFallback = ({
    applyCurated,
    buildGoogleMetadata = () => ({}),
    afterGoogleApply
  }) => (command) => {
    const url = String(command.payload?.url || '');
    const handledGooglePhoto = applyGooglePhotoMetadata({
      url,
      metadata: buildGoogleMetadata(command),
      afterApply: () => afterGoogleApply?.(command)
    });

    if (handledGooglePhoto) {
      return;
    }

    return applyCurated(command);
  };

  const statePatch = async (command) => {
    const patch = isPlainObject(command.payload) ? command.payload : {};
    const {
      widgets,
      visionConfig,
      autoLocation,
      manualLocation
    } = patch;
    let changed = false;
    let refreshWeather = false;

    STATE_PATCH_FIELDS.forEach((field) => {
      if (patch[field] === undefined || state[field] === patch[field]) {
        return;
      }

      state[field] = patch[field];
      changed = true;
    });

    if (isPlainObject(widgets)) {
      Object.keys(widgets).forEach((widgetName) => {
        if (!Object.prototype.hasOwnProperty.call(state.widgets || {}, widgetName)) {
          return;
        }

        const visible = Boolean(widgets[widgetName]);
        if (state.widgets[widgetName] !== visible) {
          state.widgets[widgetName] = visible;
          changed = true;
        }
      });
    }

    if (isPlainObject(visionConfig)) {
      state.visionConfig = { ...visionConfig };
      changed = true;
    }

    if (autoLocation !== undefined && state.autoLocation !== autoLocation) {
      state.autoLocation = Boolean(autoLocation);
      changed = true;
      refreshWeather = true;
    }

    if (isPlainObject(manualLocation)) {
      state.manualLocation = { ...manualLocation };
      changed = true;
      refreshWeather = true;
    }

    if (!changed) {
      return;
    }

    saveCuratedCollections(collections, state);
    if (refreshWeather && typeof triggerWeatherUpdate === 'function') {
      await triggerWeatherUpdate();
    }
    broadcast();
  };

  const categorySelection = (command) => {
    const validCategories = normalizeSocketCategories(command.payload?.categories).filter((name) => Boolean(collections[name]));

    if (validCategories.length === 0) {
      console.error(`[SOCKET EVENT] ERROR: None of the categories in "${command.payload?.categories}" exist in curatedCollections keys:`, Object.keys(collections));
      return;
    }

    state.currentCategory = validCategories.join(',');
    state.photosList = combineFeedsBalanced(validCategories, collections);

    const smartPhoto = getSmartPhoto('next');
    if (smartPhoto) {
      state.activePhoto = smartPhoto;
      console.log(`[SOCKET EVENT] Selected smart starting photo: "${smartPhoto.title}"`);
    } else if (state.photosList.length > 0) {
      state.activePhoto = pickRandomPhoto(state.photosList);
      console.log(`[SOCKET EVENT] Selected random starting photo: "${state.activePhoto.title}"`);
    }

    console.log(`[SOCKET EVENT] Broadcasting state-sync with categories: "${state.currentCategory}"`);
    broadcast();
  };

  const activePhoto = (command) => {
    syncActivePhoto({ io, state }, command.payload?.photo || { url: command.payload?.url });
  };

  const photoRating = createPhotoMutationFallback({
    applyCurated: (command) => {
      updatePhotoRating(collections, state, command.payload.url, command.payload.rating);
      if (command.payload.rating === 1 && state.activePhoto && state.activePhoto.url === command.payload.url) {
        const nextPhoto = getSmartPhoto('next');
        if (nextPhoto) {
          syncActivePhoto({ io, state }, nextPhoto);
        }
      }
      broadcast();
    },
    buildGoogleMetadata: (command) => buildDefinedMetadataPatch({
      rating: command.payload?.rating
    })
  });

  const photoCrop = createPhotoMutationFallback({
    applyCurated: (command) => {
      updatePhotoCrop(
        collections,
        state,
        command.payload.url,
        command.payload.cropPercent,
        command.payload.cropPositionY
      );
      broadcast();
    },
    buildGoogleMetadata: (command) => buildDefinedMetadataPatch({
      cropPercent: command.payload?.cropPercent,
      cropPositionY: command.payload?.cropPositionY
    })
  });

  const photoPreventPairing = createPhotoMutationFallback({
    applyCurated: (command) => {
      const { url, preventPairing, preserveActive } = command.payload;
      updatePhotoPreventPairing(collections, state, url, preventPairing);
      if (preventPairing && preserveActive) {
        const focusedPhoto = state.photosList?.find((photo) => photo?.url === url);
        if (focusedPhoto) {
          state.activePhoto = { ...focusedPhoto };
          state.activeSecondPhoto = null;
        }
      }
      broadcast();
    },
    buildGoogleMetadata: (command) => buildDefinedMetadataPatch({
      preventPairing: command.payload?.preventPairing
    }),
    afterGoogleApply: (command) => {
      if (command.payload.preventPairing && command.payload.preserveActive) {
        const focusedPhoto = state.photosList?.find((photo) => photo?.url === command.payload.url);
        if (focusedPhoto) {
          state.activePhoto = { ...focusedPhoto };
          state.activeSecondPhoto = null;
        }
      }
    }
  });

  const photoMetadata = createPhotoMutationFallback({
    applyCurated: () => {},
    buildGoogleMetadata: (command) => buildDefinedMetadataPatch({
      orientation: command.payload?.orientation,
      width: command.payload?.width,
      height: command.payload?.height
    })
  });

  const poolKeywords = (command) => {
    const { name, keywords } = command.payload;
    if (!collections[name]) {
      return;
    }

    state.searchKeywords[name] = [...keywords];
    saveCuratedCollections(collections, state);
    console.log(`[Config Socket] Saved updated search keywords for category "${name}":`, state.searchKeywords[name]);
    broadcast();
  };

  const poolFeedConfig = (command) => {
    const { name, source, config } = command.payload;
    if (!collections[name]) {
      return;
    }

    state.feedConfigs ??= {};
    state.feedConfigs[name] ??= {};
    state.feedConfigs[name][source] = {
      ...state.feedConfigs[name][source],
      ...config
    };

    saveCuratedCollections(collections, state);
    console.log(`[Config Socket] Saved updated feed config for category "${name}" source "${source}":`, state.feedConfigs[name][source]);
    broadcast();
  };

  const addPool = async (command) => {
    const { name, keywords } = command.payload;
    if (collections[name] || state.searchKeywords?.[name]) {
      console.warn(`Category "${name}" already exists.`);
      return;
    }

    console.log(`[SOCKET EVENT] add-category received: "${name}" with keywords:`, keywords);

    state.searchKeywords ??= {};
    state.searchKeywords[name] = [...keywords];
    state.feedConfigs ??= {};
    state.feedConfigs[name] = buildDefaultPoolFeedConfig(keywords);
    collections[name] = [];

    saveCuratedCollections(collections, state);
    broadcast();

    try {
      const { crawlAllCollections } = require('./services/crawler.js');
      const { updatedCollections, updatedAny } = await crawlAllCollections(collections, state.feedConfigs, state.searchKeywords);
      if (updatedAny) {
        Object.entries(updatedCollections).forEach(([key, photos]) => {
          collections[key] = photos;
        });
        saveCuratedCollections(collections, state);
      }

      const currentCats = splitCategories(state.currentCategory);
      if (currentCats.includes(name)) {
        state.photosList = combineFeedsBalanced(currentCats, collections);
        if (state.photosList.length > 0) {
          syncActivePhoto({ io, state }, getSmartPhoto('next') || state.photosList[0]);
        }
      }

      broadcast();

      const { triggerImageAnalysisBackground } = require('./app.js');
      triggerImageAnalysisBackground().catch((error) => console.error('Error in background image analysis:', error));
    } catch (error) {
      console.error(`Error crawling new category "${name}":`, error.message);
    }
  };

  const deletePool = (command) => {
    const { name } = command.payload;
    if (!collections[name] && !state.searchKeywords?.[name]) {
      return;
    }

    console.log(`[SOCKET EVENT] delete-category received: "${name}"`);

    if (state.searchKeywords) {
      delete state.searchKeywords[name];
    }
    if (state.feedConfigs) {
      delete state.feedConfigs[name];
    }
    delete collections[name];

    saveCuratedCollections(collections, state);

    const currentCats = splitCategories(state.currentCategory);
    if (currentCats.includes(name)) {
      const remainingCats = currentCats.filter((category) => category !== name);
      if (remainingCats.length > 0) {
        state.currentCategory = remainingCats.join(',');
      } else {
        const remainingKeys = Object.keys(state.searchKeywords || {});
        state.currentCategory = remainingKeys[0] || 'Scenic Nature';
      }

      const updatedCats = splitCategories(state.currentCategory);
      state.photosList = combineFeedsBalanced(updatedCats, collections);
      const smartPhoto = getSmartPhoto('next');
      state.activePhoto = smartPhoto || pickRandomPhoto(state.photosList);
    }

    broadcast();
  };

  const envSecret = ({ envKey, runtimeFlag }) => (command) => {
    const value = String(command.payload?.value || '');
    persistEnvVars({ [envKey]: value });
    state[runtimeFlag] = Boolean(value);
    broadcast();
  };

  const excludedKeywords = (command) => {
    const keywords = normalizeKeywordList(command.payload?.keywords);
    state.excludedKeywords = keywords;
    saveCuratedCollections(collections, state);

    const currentCats = splitCategories(state.currentCategory);
    state.photosList = combineFeedsBalanced(currentCats, collections);

    if (state.photosList.length > 0) {
      const matchesExcludedKeyword = (photo) => keywords.some((keyword) => (
        photo?.title?.toLowerCase().includes(keyword.toLowerCase())
      ));

      if (matchesExcludedKeyword(state.activePhoto)) {
        state.activePhoto = pickRandomPhoto(state.photosList);
      }
    }

    broadcast();
    console.log('[SOCKET EVENT] update-excluded-keywords saved and broadcasted:', state.excludedKeywords);
  };

  const brokenPhoto = createPhotoMutationFallback({
    applyCurated: (command) => {
      const updated = markPhotoBroken(collections, state, command.payload.url);
      if (!updated) {
        return;
      }

      if (state.activePhoto && state.activePhoto.url === command.payload.url) {
        const nextPhoto = getSmartPhoto('next');
        if (nextPhoto) {
          syncActivePhoto({ io, state }, nextPhoto);
        }
      }
      broadcast();
    },
    buildGoogleMetadata: () => ({ rating: 1, isBroken: true })
  });

  const advancePhoto = (direction) => () => {
    const photo = getSmartPhoto(direction);
    if (photo) {
      syncActivePhoto({ io, state }, photo);
    }
  };

  const screensaverActive = (command) => {
    if (command.payload.active) {
      state.screensaverActive = true;
      setManualOverride(true);
      launchKioskBrowser();
    } else {
      state.screensaverActive = false;
      setManualOverride(false);
      killKioskBrowser();
    }
    broadcast();
  };

  return {
    statePatch,
    categorySelection,
    activePhoto,
    photoRating,
    photoCrop,
    photoPreventPairing,
    photoMetadata,
    poolKeywords,
    poolFeedConfig,
    addPool,
    deletePool,
    envSecret,
    excludedKeywords,
    brokenPhoto,
    advancePhoto,
    screensaverActive
  };
}

module.exports = {
  createSocketLegacyCompatibility
};
