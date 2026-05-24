/* ═══════════════════════════════════════════════════════════
   favorites-ui.js — Creators view (manage tracked channels)
═══════════════════════════════════════════════════════════ */
(function () {
  if (!window.SCAL) window.SCAL = {};

  const { escapeHtml } = SCAL.utils;

  const SEARCH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

  let containerEl    = null;
  let allChannels    = [];
  let favIds         = new Set();

  /* ─── render (entry point from panel) ───────────────────── */
  async function render(container) {
    containerEl = container;
    container.innerHTML = `
      <div class="scal-loading" style="padding: 40px 16px;">
        <div class="scal-spinner"></div>
        <span>Loading your channels…</span>
      </div>
    `;

    try {
      const [favorites, channels] = await Promise.all([
        SCAL.storage.getFavorites(),
        SCAL.channelDiscovery.fetchSubscriptions(),
      ]);

      favIds      = new Set(Object.keys(favorites));
      allChannels = channels;
      renderContent('');
    } catch (e) {
      console.warn('[SCAL] Creators view error:', e.message);
      container.innerHTML = `
        <div class="scal-error" style="padding: 32px 16px;">
          <div>Could not load subscriptions.</div>
          <button class="scal-btn scal-btn-secondary" style="margin-top: 10px;"
                  onclick="SCAL.creatorsView.render(document.getElementById('scal-panel-body'))">
            Retry
          </button>
        </div>
      `;
    }
  }

  /* ─── renderContent ──────────────────────────────────────── */
  function renderContent(query) {
    if (!containerEl) return;

    const filtered = query
      ? allChannels.filter(ch => ch.name.toLowerCase().includes(query.toLowerCase()))
      : allChannels;

    const favCount = favIds.size;

    containerEl.innerHTML = `
      <div class="scal-creators-header">
        <span class="scal-creators-title">Your Creators</span>
        ${favCount > 0 ? `<span class="scal-count-badge">${favCount}</span>` : ''}
        ${favCount > 0 ? `<button class="scal-btn scal-btn-sm scal-clear-all-btn"
                                  style="margin-left:auto;font-size:12px;">Clear all</button>` : ''}
      </div>
      <div class="scal-search-wrap">
        ${SEARCH_SVG}
        <input
          class="scal-search-input"
          type="text"
          placeholder="Search channels…"
          value="${escapeHtml(query)}"
          aria-label="Search channels"
        />
      </div>
      <div class="scal-channel-list" id="scal-channel-list"></div>
      <div class="scal-creators-info">
        Only favorited creators are used to generate upload predictions.
      </div>
    `;

    // Wire search
    containerEl.querySelector('.scal-search-input').addEventListener('input', e => {
      renderContent(e.target.value);
    });

    // Wire clear all
    containerEl.querySelector('.scal-clear-all-btn')?.addEventListener('click', clearAll);

    // Render channel rows
    const listEl = document.getElementById('scal-channel-list');

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="scal-no-results">
          ${query ? `No channels match "<strong>${escapeHtml(query)}</strong>"` : 'No channels found.'}
        </div>
      `;
      return;
    }

    filtered.forEach(ch => {
      const isFav = favIds.has(ch.id);
      const row   = document.createElement('div');
      row.className = 'scal-creator-row';

      // Handle from href (/@handle or /channel/id)
      let handle = '';
      if (ch.href) {
        const m = ch.href.match(/\/@([^/?]+)/);
        handle = m ? `@${m[1]}` : ch.href.replace('/channel/', '').slice(0, 20);
      }

      const bgColor = ch.color || stringToColor(ch.id);
      const initial = (ch.name || '?').charAt(0).toUpperCase();
      const avatarHtml = ch.avatar
        ? `<img src="${escapeHtml(ch.avatar)}" alt="" loading="lazy"
               style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
        : `<div style="width:34px;height:34px;border-radius:50%;background:${escapeHtml(bgColor)};
                display:flex;align-items:center;justify-content:center;
                font-size:13px;font-weight:600;color:#fff;flex-shrink:0;">${escapeHtml(initial)}</div>`;

      row.innerHTML = `
        ${avatarHtml}
        <div class="scal-creator-info">
          <div class="scal-creator-name">${escapeHtml(ch.name)}</div>
          ${handle ? `<div class="scal-creator-handle">${escapeHtml(handle)}</div>` : ''}
        </div>
        <button class="scal-fav-btn ${isFav ? 'scal-is-fav' : ''}"
                data-id="${escapeHtml(ch.id)}"
                aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}"
                title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
          ${isFav ? '★' : '☆'}
        </button>
      `;

      row.querySelector('.scal-fav-btn').addEventListener('click', e => {
        e.stopPropagation();
        toggleFavorite(ch, e.currentTarget, query);
      });

      listEl.appendChild(row);
    });
  }

  /* ─── toggleFavorite ─────────────────────────────────────── */
  async function toggleFavorite(channel, btn, currentQuery) {
    const isFav = favIds.has(channel.id);

    if (isFav) {
      await SCAL.storage.removeFavorite(channel.id);
      favIds.delete(channel.id);
    } else {
      // Attach color for calendar rendering
      channel.color = channel.color || stringToColor(channel.id);
      await SCAL.storage.addFavorite(channel);
      favIds.add(channel.id);
    }

    // Re-render keeping the current search query
    renderContent(currentQuery || '');
  }

  /* ─── clearAll ───────────────────────────────────────────── */
  async function clearAll() {
    await SCAL.storage.clearFavorites();
    favIds.clear();
    renderContent('');
  }

  /* ─── Deterministic color from channel id ────────────────── */
  function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h},50%,40%)`;
  }

  /* ─── Legacy show/hide (kept for backward compat) ────────── */
  function show(container) { render(container); }
  function hide() {
    if (containerEl) containerEl.innerHTML = '';
  }

  window.SCAL.creatorsView = { render };
  window.SCAL.favoritesUI  = { show, hide, renderFavorites: render };
})();
