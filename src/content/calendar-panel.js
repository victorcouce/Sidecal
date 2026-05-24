(function () {
  if (!window.SCAL) window.SCAL = {};

  let panelEl = null;
  let isOpen = false;

  function createPanel() {
    const panel = document.createElement('div');
    panel.className = 'scal-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', SCAL.i18n.t('calendar'));

    panel.innerHTML = `
      <div class="scal-panel-header">
        <h2 class="scal-panel-title">${SCAL.utils.escapeHtml(SCAL.i18n.t('calendar'))}</h2>
        <button class="scal-btn-icon scal-panel-close" aria-label="${SCAL.utils.escapeHtml(SCAL.i18n.t('close'))}">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="scal-panel-body" id="scal-panel-body"></div>
      <div class="scal-panel-footer">
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <button class="scal-btn scal-btn-secondary scal-refresh-btn" title="Refresh predictions">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 2.2"/></svg>
            Refresh
          </button>
          <button class="scal-btn scal-btn-secondary scal-manage-fav-btn" style="flex: 1;">
            ⭐ Manage
          </button>
        </div>
        <span class="scal-disclaimer">${SCAL.utils.escapeHtml(SCAL.i18n.t('disclaimer'))}</span>
      </div>
    `;

    panel.querySelector('.scal-panel-close').addEventListener('click', close);
    panel.querySelector('.scal-refresh-btn').addEventListener('click', manualRefresh);
    panel.querySelector('.scal-manage-fav-btn').addEventListener('click', () => {
      SCAL.favoritesUI.show(document.getElementById('scal-panel-body'));
    });

    return panel;
  }

  async function open() {
    if (isOpen && panelEl) return;

    if (!panelEl) {
      panelEl = createPanel();
    }

    const appEl = document.querySelector('ytd-app') || document.body;
    appEl.appendChild(panelEl);
    isOpen = true;

    requestAnimationFrame(() => {
      panelEl.classList.add('scal-panel-open');
    });

    SCAL.calendarUI.render(document.getElementById('scal-panel-body'));

    document.querySelector('.scal-sidebar-entry')?.classList.add('scal-active');

    // Load and analyze data
    loadPredictions();
  }

  async function manualRefresh() {
    const btn = panelEl?.querySelector('.scal-refresh-btn');
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
    }

    try {
      await loadPredictions();
      if (btn) {
        btn.textContent = '✓ Done';
        setTimeout(() => {
          btn.textContent = '⟳ Refresh';
          btn.disabled = false;
          btn.style.opacity = '1';
        }, 2000);
      }
    } catch (e) {
      console.warn('[SCAL] Manual refresh error:', e.message);
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    }
  }

  async function loadPredictions() {
    const panelBody = document.getElementById('scal-panel-body');
    if (!panelBody) return;

    // Show loading state
    const loadingEl = document.createElement('div');
    loadingEl.className = 'scal-loading';
    loadingEl.innerHTML = `
      <div class="scal-spinner"></div>
      <span>${SCAL.i18n.t('loading')}</span>
    `;
    panelBody.innerHTML = '';
    panelBody.appendChild(loadingEl);

    try {
      const favorites = await SCAL.storage.getFavorites();
      const favList = Object.values(favorites);

      if (favList.length === 0) {
        // No favorites, empty state will be shown by calendarUI
        SCAL.calendarUI.renderContent();
        return;
      }

      // For each favorite, get videos and analyze
      let successCount = 0;
      for (const channel of favList) {
        try {
          // Check if should refresh from RSS
          const shouldRefresh = await SCAL.videoCache.shouldRefresh(channel.id);
          let videos = null;

          if (shouldRefresh) {
            videos = await SCAL.rssFetcher.fetchChannelRSS(channel.id);
            if (videos) {
              await SCAL.videoCache.cacheVideos(channel.id, videos, channel.name);
            }
          } else {
            videos = await SCAL.videoCache.getCachedVideos(channel.id);
          }

          // Analyze and save prediction
          if (videos && videos.length > 0) {
            const analysis = SCAL.prediction.analyzeChannel(videos);
            await SCAL.storage.setPrediction(channel.id, {
              channelId: channel.id,
              channelName: channel.name,
              channelAvatar: channel.avatar,
              ...analysis,
              calculatedAt: new Date().toISOString(),
            });
            successCount++;
          }
        } catch (e) {
          console.warn(`[SCAL] Error loading predictions for ${channel.name}:`, e.message);
        }
      }

      // Update settings with last refresh time
      const settings = await SCAL.storage.getSettings();
      settings.lastGlobalRefresh = new Date().toISOString();
      await SCAL.storage.saveSettings(settings);

      // Render predictions on calendar
      const predictions = await SCAL.storage.getPredictions();
      const predList = Object.values(predictions);

      // Clear loading and re-render calendar with predictions
      loadingEl.remove();
      SCAL.calendarUI.renderMonth(panelBody, new Date().getFullYear(), new Date().getMonth());
      SCAL.calendarUI.renderContent();
      SCAL.calendarUI.renderPredictions(predList);

      console.log(`[SCAL] Loaded predictions for ${successCount} channels`);
    } catch (e) {
      console.warn('[SCAL] Error loading predictions:', e.message);

      // Show error state
      panelBody.innerHTML = '';
      const errorEl = document.createElement('div');
      errorEl.className = 'scal-error';
      errorEl.innerHTML = `
        <div>${SCAL.utils.escapeHtml(SCAL.i18n.t('errorGeneral'))}</div>
        <button class="scal-btn scal-btn-secondary scal-error-retry" style="margin-top: 8px;">${SCAL.utils.escapeHtml(SCAL.i18n.t('retry'))}</button>
      `;
      errorEl.querySelector('.scal-error-retry').addEventListener('click', () => {
        loadPredictions();
      });
      panelBody.appendChild(errorEl);
    }
  }

  function close() {
    if (!isOpen || !panelEl) return;

    panelEl.classList.remove('scal-panel-open');
    panelEl.addEventListener('transitionend', () => {
      panelEl.remove();
      panelEl = null;
    }, { once: true });

    isOpen = false;
    document.querySelector('.scal-sidebar-entry')?.classList.remove('scal-active');
  }

  function toggle() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  window.SCAL.calendarPanel = {
    open,
    close,
    toggle,
    isOpen: () => isOpen,
  };
})();
