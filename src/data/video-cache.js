(function () {
  if (!window.SCAL) window.SCAL = {};

  const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

  async function getCachedVideos(channelId) {
    try {
      const data = await SCAL.storage.getAll();
      const videoCache = data.videoCache || {};
      const cached = videoCache[channelId];

      if (!cached) return null;

      const now = Date.now();
      const age = now - new Date(cached.fetchedAt).getTime();

      if (age > CACHE_TTL_MS) {
        console.log(`[SCAL] Cache expired for ${channelId}`);
        return null;
      }

      console.log(`[SCAL] Cache hit for ${channelId}`);
      return cached.videos || [];
    } catch (e) {
      console.warn('[SCAL] getCachedVideos error:', e.message);
      return null;
    }
  }

  async function cacheVideos(channelId, videos, channelName = channelId) {
    try {
      await SCAL.storage.setVideoCache(channelId, videos);
      console.log(`[SCAL] Cached ${videos?.length || 0} videos for ${channelName}`);
      return true;
    } catch (e) {
      console.warn('[SCAL] cacheVideos error:', e.message);
      return false;
    }
  }

  async function shouldRefresh(channelId) {
    try {
      const cached = await getCachedVideos(channelId);
      // If no cache exists, should refresh
      // If cache exists but we already logged "Cache hit", it means it's valid
      // Return false if cache is valid, true if should refresh
      return cached === null;
    } catch (e) {
      console.warn('[SCAL] shouldRefresh error:', e.message);
      return true; // Default to refresh on error
    }
  }

  async function clearCache() {
    try {
      await SCAL.storage.clearVideoCache();
      console.log('[SCAL] Cleared all video cache');
      return true;
    } catch (e) {
      console.warn('[SCAL] clearCache error:', e.message);
      return false;
    }
  }

  async function clearChannelCache(channelId) {
    try {
      const all = await SCAL.storage.getAll();
      const videoCache = all.videoCache || {};
      delete videoCache[channelId];

      // Save back the entire videoCache without the deleted channel
      const storage = SCAL.storage;
      if (storage.invalidateCache) storage.invalidateCache();
      await chrome.storage.local.set({ videoCache });

      console.log(`[SCAL] Cleared cache for ${channelId}`);
      return true;
    } catch (e) {
      console.warn('[SCAL] clearChannelCache error:', e.message);
      return false;
    }
  }

  async function getCacheTTL() {
    return CACHE_TTL_MS;
  }

  window.SCAL.videoCache = {
    getCachedVideos,
    cacheVideos,
    shouldRefresh,
    clearCache,
    clearChannelCache,
    getCacheTTL,
  };
})();
