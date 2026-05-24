/* ═══════════════════════════════════════════════════════════
   calendar-panel.js — Sidecal sliding panel with 3-tab UI
═══════════════════════════════════════════════════════════ */
(function () {
  if (!window.SCAL) window.SCAL = {};

  let panelEl   = null;
  let isOpen    = false;
  let curView   = 'calendar'; // 'calendar' | 'list' | 'creators'
  let lastUpdated = null;

  /* ─── SVG icons ──────────────────────────────────────────── */
  const IC_REFRESH = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 2.2"/></svg>`;
  const IC_CLOSE   = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const IC_INFO    = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

  /* ─── Build panel DOM ────────────────────────────────────── */
  function createPanel() {
    const panel = document.createElement('div');
    panel.className = 'scal-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Sidecal predictive calendar');

    panel.innerHTML = `
      <div class="scal-panel-header">
        <div class="scal-panel-title-row">
          <div class="scal-panel-title-text">
            <span class="scal-panel-title">Sidecal</span>
            <span class="scal-panel-meta" id="scal-panel-meta">Predictive calendar</span>
          </div>
          <div class="scal-panel-title-actions">
            <button class="scal-btn scal-btn-sm scal-refresh-btn">
              ${IC_REFRESH}<span class="scal-refresh-label">Refresh</span>
            </button>
            <button class="scal-btn-icon scal-panel-close" aria-label="Close Sidecal">
              ${IC_CLOSE}
            </button>
          </div>
        </div>
        <div class="scal-view-tabs" role="tablist">
          <button class="scal-view-tab scal-tab-active" data-view="calendar" role="tab" aria-selected="true">Calendar</button>
          <button class="scal-view-tab" data-view="list" role="tab" aria-selected="false">List</button>
          <button class="scal-view-tab" data-view="creators" role="tab" aria-selected="false">Creators</button>
        </div>
      </div>
      <div class="scal-info-banner" id="scal-info-banner">
        ${IC_INFO}
        <span>Predictions are estimates based on upload history. Not confirmed by creators.</span>
      </div>
      <div class="scal-panel-body" id="scal-panel-body"></div>
    `;

    panel.querySelector('.scal-panel-close').addEventListener('click', close);
    panel.querySelector('.scal-refresh-btn').addEventListener('click', manualRefresh);
    panel.querySelectorAll('.scal-view-tab').forEach(tab => {
      tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    return panel;
  }

  /* ─── Tab switching ──────────────────────────────────────── */
  function switchView(view) {
    curView = view;

    if (!panelEl) return;

    // Update tab active states
    panelEl.querySelectorAll('.scal-view-tab').forEach(tab => {
      const active = tab.dataset.view === view;
      tab.classList.toggle('scal-tab-active', active);
      tab.setAttribute('aria-selected', String(active));
    });

    // Info banner only for calendar / list
    const banner = panelEl.querySelector('#scal-info-banner');
    if (banner) banner.style.display = view === 'creators' ? 'none' : '';

    renderCurrentView();
  }

  /* ─── Render the active view ─────────────────────────────── */
  function renderCurrentView() {
    const body = document.getElementById('scal-panel-body');
    if (!body) return;
    body.innerHTML = '';

    if (curView === 'calendar') {
      SCAL.calendarUI.render(body);
      loadPredictions();
    } else if (curView === 'list') {
      SCAL.listView.render(body);
      loadPredictions();
    } else if (curView === 'creators') {
      SCAL.creatorsView.render(body);
    }
  }

  /* ─── Load & analyze predictions ────────────────────────── */
  async function loadPredictions() {
    const favorites = await SCAL.storage.getFavorites();
    const favList   = Object.values(favorites);

    if (favList.length === 0) {
      if (curView === 'calendar') {
        SCAL.calendarUI.showEmpty(() => switchView('creators'));
      } else if (curView === 'list') {
        SCAL.listView.showEmpty(() => switchView('creators'));
      }
      return;
    }

    try {
      for (const channel of favList) {
        try {
          const shouldRefresh = await SCAL.videoCache.shouldRefresh(channel.id);
          let videos = null;

          if (shouldRefresh) {
            videos = await SCAL.rssFetcher.fetchChannelRSS(channel.id);
            if (videos) await SCAL.videoCache.cacheVideos(channel.id, videos, channel.name);
          } else {
            videos = await SCAL.videoCache.getCachedVideos(channel.id);
          }

          if (videos && videos.length > 0) {
            const analysis = SCAL.prediction.analyzeChannel(videos);
            await SCAL.storage.setPrediction(channel.id, {
              channelId:     channel.id,
              channelName:   channel.name,
              channelAvatar: channel.avatar,
              channelColor:  channel.color,
              ...analysis,
              calculatedAt: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.warn(`[SCAL] Error loading ${channel.name}:`, e.message);
        }
      }

      // Stamp last-updated time
      lastUpdated = new Date();
      const settings = await SCAL.storage.getSettings();
      settings.lastGlobalRefresh = lastUpdated.toISOString();
      await SCAL.storage.saveSettings(settings);
      updateMeta();

      // Fetch stored predictions and render
      const stored   = await SCAL.storage.getPredictions();
      const predList = Object.values(stored);

      if (curView === 'calendar') {
        SCAL.calendarUI.renderPredictions(predList);
      } else if (curView === 'list') {
        SCAL.listView.renderPredictions(predList);
      }
    } catch (e) {
      console.warn('[SCAL] loadPredictions error:', e.message);
      if (curView === 'calendar') {
        SCAL.calendarUI.showError(() => loadPredictions());
      } else if (curView === 'list') {
        SCAL.listView.showError(() => loadPredictions());
      }
    }
  }

  /* ─── Update meta line ───────────────────────────────────── */
  function updateMeta() {
    const el = document.getElementById('scal-panel-meta');
    if (!el || !lastUpdated) return;
    const t = lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    el.textContent = `Predictive calendar · Updated ${t}`;
  }

  /* ─── Manual refresh ─────────────────────────────────────── */
  async function manualRefresh() {
    const btn = panelEl?.querySelector('.scal-refresh-btn');
    if (!btn || btn.disabled) return;

    btn.disabled = true;
    const label = btn.querySelector('.scal-refresh-label');
    if (label) label.textContent = 'Refreshing…';

    try {
      // Bust the video cache so RSS is re-fetched
      await SCAL.videoCache.clearCache();
      SCAL.storage.invalidateCache();
      await loadPredictions();
    } finally {
      btn.disabled = false;
      if (label) label.textContent = 'Refresh';
    }
  }

  /* ─── Open / close / toggle ──────────────────────────────── */
  async function open() {
    if (isOpen && panelEl) return;
    if (!panelEl) panelEl = createPanel();

    const appEl = document.querySelector('ytd-app') || document.body;
    appEl.appendChild(panelEl);
    isOpen = true;

    requestAnimationFrame(() => panelEl.classList.add('scal-panel-open'));
    document.querySelector('.scal-sidebar-entry')?.classList.add('scal-active');

    // Restore last-updated time from storage
    try {
      const settings = await SCAL.storage.getSettings();
      if (settings.lastGlobalRefresh) {
        lastUpdated = new Date(settings.lastGlobalRefresh);
        updateMeta();
      }
    } catch (_) {}

    switchView(curView);
  }

  function close() {
    if (!isOpen || !panelEl) return;
    panelEl.classList.remove('scal-panel-open');
    panelEl.addEventListener('transitionend', () => {
      panelEl?.remove();
      panelEl = null;
    }, { once: true });
    isOpen = false;
    document.querySelector('.scal-sidebar-entry')?.classList.remove('scal-active');
  }

  function toggle() {
    isOpen ? close() : open();
  }

  window.SCAL.calendarPanel = {
    open,
    close,
    toggle,
    isOpen:     () => isOpen,
    switchView,
  };
})();
