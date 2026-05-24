(function () {
  if (!window.SCAL) window.SCAL = {};

  const DEFAULT_SETTINGS = {
    defaultView: 'month',
    showLowConfidence: true,
    lastGlobalRefresh: null,
  };

  function isContextValid() {
    try {
      return !!chrome.runtime?.id;
    } catch (_) {
      return false;
    }
  }

  function localGet(keys) {
    if (!isContextValid()) return Promise.resolve({});
    return chrome.storage.local.get(keys).catch((e) => {
      console.warn('[SCAL] storage.local.get error:', e.message);
      return {};
    });
  }

  function localSet(items) {
    if (!isContextValid()) return Promise.resolve(false);
    return chrome.storage.local.set(items).then(() => true).catch((e) => {
      console.warn('[SCAL] storage.local.set error:', e.message);
      return false;
    });
  }

  function localRemove(keys) {
    if (!isContextValid()) return Promise.resolve(false);
    return chrome.storage.local.remove(keys).then(() => true).catch((e) => {
      console.warn('[SCAL] storage.local.remove error:', e.message);
      return false;
    });
  }

  let _memCache = null;

  function invalidateCache() {
    _memCache = null;
  }

  async function getAll() {
    if (_memCache) return _memCache;
    const data = await localGet(['favorites', 'videoCache', 'predictions', 'settings']);
    _memCache = {
      favorites: data.favorites || {},
      videoCache: data.videoCache || {},
      predictions: data.predictions || {},
      settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
    };
    return _memCache;
  }

  async function getFavorites() {
    const all = await getAll();
    return all.favorites;
  }

  async function addFavorite(channel) {
    const favorites = await getFavorites();
    favorites[channel.id] = {
      id: channel.id,
      name: channel.name,
      avatar: channel.avatar,
      handle: channel.handle,
      addedAt: new Date().toISOString(),
    };
    if (_memCache) _memCache.favorites = favorites;
    return localSet({ favorites });
  }

  async function removeFavorite(channelId) {
    const favorites = await getFavorites();
    delete favorites[channelId];
    if (_memCache) _memCache.favorites = favorites;
    return localSet({ favorites });
  }

  async function isFavorite(channelId) {
    const favorites = await getFavorites();
    return !!favorites[channelId];
  }

  async function clearFavorites() {
    if (_memCache) _memCache.favorites = {};
    return localSet({ favorites: {} });
  }

  async function getVideoCache() {
    const all = await getAll();
    return all.videoCache;
  }

  async function setVideoCache(channelId, videos) {
    const cache = await getVideoCache();
    cache[channelId] = {
      fetchedAt: new Date().toISOString(),
      videos,
    };
    if (_memCache) _memCache.videoCache = cache;
    return localSet({ videoCache: cache });
  }

  async function getChannelVideoCache(channelId) {
    const cache = await getVideoCache();
    return cache[channelId] || null;
  }

  async function clearVideoCache() {
    if (_memCache) _memCache.videoCache = {};
    return localSet({ videoCache: {} });
  }

  async function getPredictions() {
    const all = await getAll();
    return all.predictions;
  }

  async function savePredictions(predictions) {
    if (_memCache) _memCache.predictions = predictions;
    return localSet({ predictions });
  }

  async function setPrediction(channelId, prediction) {
    const predictions = await getPredictions();
    predictions[channelId] = prediction;
    if (_memCache) _memCache.predictions = predictions;
    return localSet({ predictions });
  }

  async function getSettings() {
    const all = await getAll();
    return all.settings;
  }

  async function saveSettings(settings) {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    if (_memCache) _memCache.settings = merged;
    return localSet({ settings: merged });
  }

  async function cleanOrphanData() {
    const all = await getAll();
    const favIds = Object.keys(all.favorites);
    const videoCache = { ...all.videoCache };
    const predictions = { ...all.predictions };
    let changed = false;

    for (const id of Object.keys(videoCache)) {
      if (!favIds.includes(id)) {
        delete videoCache[id];
        changed = true;
      }
    }
    for (const id of Object.keys(predictions)) {
      if (!favIds.includes(id)) {
        delete predictions[id];
        changed = true;
      }
    }

    if (changed) {
      if (_memCache) {
        _memCache.videoCache = videoCache;
        _memCache.predictions = predictions;
      }
      await localSet({ videoCache, predictions });
    }
  }

  function onChange(callback) {
    try {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local') {
          invalidateCache();
          try { callback(changes); } catch (e) {
            console.warn('[SCAL] onChange callback error:', e.message);
          }
        }
      });
    } catch (e) {
      console.warn('[SCAL] onChange registration error:', e.message);
    }
  }

  window.SCAL.storage = {
    isContextValid,
    getAll,
    getFavorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    clearFavorites,
    getVideoCache,
    setVideoCache,
    getChannelVideoCache,
    clearVideoCache,
    getPredictions,
    savePredictions,
    setPrediction,
    getSettings,
    saveSettings,
    cleanOrphanData,
    onChange,
    invalidateCache,
  };
})();
