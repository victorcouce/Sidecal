(function () {
  console.log('[SCAL] Service worker started');

  chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') {
      console.log('[SCAL] Extension installed');
      // Create alarm for periodic refresh (every 6 hours)
      chrome.alarms.create('scal-refresh', { periodInMinutes: 360 });
      console.log('[SCAL] Scheduled auto-refresh every 6 hours');
    }
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'scal-refresh') {
      console.log('[SCAL] Auto-refresh triggered');
      refreshPredictions();
    }
  });

  async function refreshPredictions() {
    try {
      // Get favorites from storage
      const data = await chrome.storage.local.get(['favorites', 'videoCache']);
      const favorites = data.favorites || {};
      const videoCache = data.videoCache || {};
      const favList = Object.values(favorites);

      if (favList.length === 0) {
        console.log('[SCAL] No favorites to refresh');
        return;
      }

      let updatedCount = 0;

      // For each favorite, check if cache needs refresh
      for (const channel of favList) {
        try {
          const cached = videoCache[channel.id];
          const now = Date.now();
          const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

          if (!cached || (now - new Date(cached.fetchedAt).getTime()) > TTL_MS) {
            // Need to refresh - use inline fetch since we're in background
            const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channel.id)}`;
            const response = await fetch(url);

            if (response.ok) {
              const xmlText = await response.text();
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

              if (xmlDoc.documentElement.nodeName !== 'parsererror') {
                const entries = xmlDoc.querySelectorAll('entry');
                const videos = [];

                entries.forEach((entry) => {
                  try {
                    let videoId = null;
                    const videoIdElem = entry.querySelector('yt\\:videoId, [xmlns\\:yt] > yt\\:videoId');
                    if (videoIdElem?.textContent) {
                      videoId = videoIdElem.textContent.trim();
                    }

                    if (!videoId) {
                      const idElem = entry.querySelector('id');
                      if (idElem?.textContent) {
                        const match = idElem.textContent.match(/yt:video:([a-zA-Z0-9_-]+)/);
                        if (match) videoId = match[1];
                      }
                    }

                    const titleElem = entry.querySelector('title');
                    const title = titleElem?.textContent?.trim();

                    const publishedElem = entry.querySelector('published');
                    const published = publishedElem?.textContent ? new Date(publishedElem.textContent) : null;

                    if (videoId && title && published) {
                      videos.push({ videoId, title, published: published.toISOString() });
                    }
                  } catch (e) {
                    // Skip malformed entries
                  }
                });

                if (videos.length > 0) {
                  videos.sort((a, b) => new Date(a.published).getTime() - new Date(b.published).getTime());
                  videoCache[channel.id] = {
                    fetchedAt: new Date().toISOString(),
                    videos,
                  };
                  updatedCount++;
                }
              }
            }
          }
        } catch (e) {
          console.warn(`[SCAL] Error refreshing ${channel.name}:`, e.message);
        }
      }

      if (updatedCount > 0) {
        await chrome.storage.local.set({ videoCache });
        // Invalidate predictions cache so they get recalculated
        await chrome.storage.local.set({ predictions: {} });
        console.log(`[SCAL] Auto-refresh completed: ${updatedCount} channels updated`);
      } else {
        console.log('[SCAL] Auto-refresh: no updates needed');
      }
    } catch (e) {
      console.warn('[SCAL] Auto-refresh error:', e.message);
    }
  }
})();
