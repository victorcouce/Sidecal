(function () {
  if (!window.SCAL) window.SCAL = {};

  function parseYtInitialData(html) {
    const match = html.match(/<script[^>]*nonce[^>]*>var ytInitialData = ({.+?});<\/script>/);
    if (!match) return null;

    const jsonStr = match[1];
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < jsonStr.length; i++) {
      const ch = jsonStr[i];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"' && !escaped) {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === '{') depth++;
      else if (ch === '}') depth--;

      if (depth === 0 && ch === '}') {
        try {
          return JSON.parse(jsonStr.slice(0, i + 1));
        } catch (e) {
          console.warn('[SCAL] Failed to parse ytInitialData:', e.message);
          return null;
        }
      }
    }
    return null;
  }

  function extractChannels(obj, channels = new Set()) {
    if (!obj || typeof obj !== 'object') return channels;

    if (obj.channelRenderer && obj.channelRenderer.channelId) {
      const id = obj.channelRenderer.channelId;
      const name = obj.channelRenderer.title?.simpleText || obj.channelRenderer.shortBylineText?.simpleText || id;
      const avatar = obj.channelRenderer.thumbnail?.thumbnails?.[obj.channelRenderer.thumbnail.thumbnails.length - 1]?.url || '';
      const href = `/channel/${id}`;

      channels.add(JSON.stringify({ id, name, avatar, href }));
    }

    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        extractChannels(obj[key], channels);
      }
    }

    return channels;
  }

  async function fetchSubscriptions() {
    try {
      const response = await fetch('https://www.youtube.com/feed/channels', {
        credentials: 'include',
      });
      const html = await response.text();
      const data = parseYtInitialData(html);

      if (!data) {
        console.warn('[SCAL] No ytInitialData found, falling back to DOM scraping');
        return scrapeChannelsFromDOM();
      }

      const channelSet = extractChannels(data);
      return Array.from(channelSet).map(ch => JSON.parse(ch));
    } catch (e) {
      console.warn('[SCAL] Fetch subscriptions error:', e.message);
      return scrapeChannelsFromDOM();
    }
  }

  function scrapeChannelsFromDOM() {
    const channels = [];
    const seen = new Set();

    const entries = document.querySelectorAll('ytd-guide-entry-renderer');
    entries.forEach((entry) => {
      const link = entry.querySelector('a');
      if (!link) return;

      const href = link.getAttribute('href') || '';
      if (!href.startsWith('/channel/') && !href.startsWith('/@') && !href.startsWith('/c/')) return;

      const channelId = href.startsWith('/channel/')
        ? href.replace('/channel/', '').split('?')[0]
        : href.split('?')[0];

      if (!channelId || seen.has(channelId)) return;
      seen.add(channelId);

      const nameEl = entry.querySelector('yt-formatted-string, #endpoint yt-formatted-string, #label');
      const name = nameEl?.textContent?.trim() || link.getAttribute('title') || channelId;

      const imgEl = entry.querySelector('img#img, yt-img-shadow img, img');
      const avatar = imgEl?.src || '';

      channels.push({ id: channelId, name, avatar, href });
    });

    return channels;
  }

  window.SCAL.channelDiscovery = {
    fetchSubscriptions,
    scrapeChannelsFromDOM,
  };
})();
