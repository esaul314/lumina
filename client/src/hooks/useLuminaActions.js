import { useMemo } from 'react';

export function useLuminaActions(socket) {
  return useMemo(() => ({
    setPhotoCrop: (url, cropPercent, cropPositionY) => {
      socket.emit('set-photo-crop', { url, cropPercent, cropPositionY });
    },
    setPreventPairing: (url, preventPairing) => {
      socket.emit('set-photo-prevent-pairing', { url, preventPairing });
    },
    ratePhoto: (url, rating) => {
      socket.emit('rate-photo', { url, rating });
    },
    setActivePhoto: (photo) => {
      socket.emit('set-active-photo', photo);
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
      socket.emit('next-photo');
    },
    triggerPrev: () => {
      socket.emit('prev-photo');
    },
    markPhotoBroken: (url) => {
      socket.emit('mark-photo-broken', { url });
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
  }), [socket]);
}
