(function () {
  if (!window.SCAL) window.SCAL = {};

  async function fetchChannelRSS(channelId) {
    try {
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.warn(`[SCAL] RSS fetch failed for ${channelId}: ${response.status}`);
        return null;
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

      if (xmlDoc.documentElement.nodeName === 'parsererror') {
        console.warn(`[SCAL] XML parse error for ${channelId}`);
        return null;
      }

      const entries = xmlDoc.querySelectorAll('entry');
      const videos = [];

      entries.forEach((entry) => {
        try {
          let videoId = null;
          let title = null;
          let published = null;

          // Try yt:videoId namespace first
          const videoIdElem = entry.querySelector('[xmlns\\:yt] > yt\\:videoId, yt\\:videoId');
          if (videoIdElem?.textContent) {
            videoId = videoIdElem.textContent.trim();
          }

          // Fallback: extract from id tag (format: urn:uuid:VIDEO_ID)
          if (!videoId) {
            const idElem = entry.querySelector('id');
            if (idElem?.textContent) {
              const match = idElem.textContent.match(/yt:video:([a-zA-Z0-9_-]+)/);
              if (match) videoId = match[1];
            }
          }

          // Get title
          const titleElem = entry.querySelector('title');
          if (titleElem?.textContent) {
            title = titleElem.textContent.trim();
          }

          // Get published date
          const publishedElem = entry.querySelector('published');
          if (publishedElem?.textContent) {
            published = new Date(publishedElem.textContent);
          }

          if (videoId && title && published) {
            videos.push({ videoId, title, published });
          }
        } catch (e) {
          console.warn('[SCAL] Error parsing RSS entry:', e.message);
        }
      });

      // Sort by date ascending (oldest first)
      videos.sort((a, b) => a.published.getTime() - b.published.getTime());

      return videos;
    } catch (e) {
      console.warn(`[SCAL] fetchChannelRSS error for ${channelId}:`, e.message);
      return null;
    }
  }

  async function fetchAllFavorites(favorites) {
    const results = new Map();
    const favoriteList = Array.isArray(favorites) ? favorites : Object.values(favorites);

    if (favoriteList.length === 0) {
      return results;
    }

    // Concurrent fetch with max 10 simultaneous
    const queue = [...favoriteList];
    const maxConcurrent = 10;
    const inFlight = new Set();
    const processing = [];

    while (queue.length > 0 || inFlight.size > 0) {
      while (inFlight.size < maxConcurrent && queue.length > 0) {
        const channel = queue.shift();
        const promise = (async () => {
          try {
            const videos = await fetchChannelRSS(channel.id);
            if (videos) {
              results.set(channel.id, { videos, error: null });
              console.log(`[SCAL] Fetched ${videos.length} videos for ${channel.name}`);
            } else {
              results.set(channel.id, { videos: [], error: 'Failed to fetch RSS' });
            }
          } catch (e) {
            results.set(channel.id, { videos: [], error: e.message });
          } finally {
            inFlight.delete(promise);
          }
        })();

        inFlight.add(promise);
        processing.push(promise);
      }

      if (inFlight.size > 0) {
        await Promise.race([...inFlight]);
      }
    }

    return results;
  }

  window.SCAL.rssFetcher = {
    fetchChannelRSS,
    fetchAllFavorites,
  };
})();
