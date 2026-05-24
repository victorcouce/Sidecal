/* ═══════════════════════════════════════════════════════════
   list-view.js — Sidecal list view (upcoming predictions)
═══════════════════════════════════════════════════════════ */
(function () {
  if (!window.SCAL) window.SCAL = {};

  let containerEl = null;

  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  function formatDateLabel(dt) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (dt.toDateString() === today.toDateString()) return 'Today';
    if (dt.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return `${DAY_NAMES[dt.getDay()]}, ${MONTH_NAMES[dt.getMonth()]} ${dt.getDate()}`;
  }

  function timeAgoShort(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    const days = Math.floor(ms / 86400000);
    if (days < 1) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    const w = Math.floor(days / 7);
    return w === 1 ? '1 week ago' : `${w} weeks ago`;
  }

  /* ─── render: initial skeleton (loading) ─────────────────── */
  function render(container) {
    containerEl = container;
    container.innerHTML = `
      <div class="scal-loading scal-list-loading" style="padding: 40px 16px;">
        <div class="scal-spinner"></div>
        <span>Loading predictions…</span>
      </div>
    `;
  }

  /* ─── showEmpty ───────────────────────────────────────────── */
  function showEmpty(onAddCreators) {
    if (!containerEl) return;
    containerEl.innerHTML = `
      <div class="scal-empty-state" style="padding: 40px 16px 24px;">
        <div class="scal-empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        </div>
        <p class="scal-empty-title">No favorites yet</p>
        <p class="scal-empty-sub">Add favorite creators to see upcoming upload predictions in a list.</p>
        <button class="scal-btn scal-btn-primary scal-empty-action">Add Creators</button>
      </div>
    `;
    containerEl.querySelector('.scal-empty-action').addEventListener('click', onAddCreators);
  }

  /* ─── showError ───────────────────────────────────────────── */
  function showError(onRetry) {
    if (!containerEl) return;
    containerEl.innerHTML = `
      <div class="scal-error" style="padding: 32px 16px;">
        <div>Could not load predictions.</div>
        <button class="scal-btn scal-btn-secondary scal-error-retry" style="margin-top: 10px;">Retry</button>
      </div>
    `;
    containerEl.querySelector('.scal-error-retry').addEventListener('click', onRetry);
  }

  /* ─── renderPredictions ───────────────────────────────────── */
  function renderPredictions(predictions) {
    if (!containerEl) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Flatten predictions → future dates only, sorted
    const items = [];
    predictions.forEach(p => {
      (p.nextDates || []).forEach(d => {
        const dt = new Date(d.date);
        if (dt >= today) {
          items.push({ prediction: p, date: dt, dateKey: dt.toDateString() });
        }
      });
    });
    items.sort((a, b) => a.date - b.date);

    if (items.length === 0) {
      containerEl.innerHTML = `
        <div class="scal-empty-state" style="padding: 32px 16px;">
          <p class="scal-empty-title" style="font-size: 14px; margin-bottom: 6px;">No upcoming predictions</p>
          <p class="scal-empty-sub">Refresh to generate new predictions for your creators.</p>
        </div>
      `;
      return;
    }

    // Group by date
    const groups = [];
    let lastKey = null;
    items.forEach(item => {
      if (item.dateKey !== lastKey) {
        groups.push({ dateKey: item.dateKey, label: formatDateLabel(item.date), items: [] });
        lastKey = item.dateKey;
      }
      groups[groups.length - 1].items.push(item);
    });

    // Build DOM
    const listEl = document.createElement('div');
    listEl.className = 'scal-list';
    const expandedKeys = new Set();

    groups.forEach(group => {
      const labelEl = document.createElement('div');
      labelEl.className = 'scal-list-group-label';
      labelEl.textContent = group.label;
      listEl.appendChild(labelEl);

      group.items.forEach(({ prediction: p, date }) => {
        const key = `${p.channelId}-${date.getTime()}`;
        listEl.appendChild(buildCard(p, date, key, expandedKeys));
      });
    });

    containerEl.innerHTML = '';
    containerEl.appendChild(listEl);
  }

  /* ─── buildCard ───────────────────────────────────────────── */
  function buildCard(p, date, key, expandedKeys) {
    const confLevel = p.confidence?.level || 'low';
    const confLabels = { high: 'High', medium: 'Medium', low: 'Low', insufficient_data: 'No data' };
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    const bgColor = p.channelColor || '#888';
    const initial = (p.channelName || '?').charAt(0).toUpperCase();
    const avatarHtml = p.channelAvatar
      ? `<img src="${esc(p.channelAvatar)}" alt="" loading="lazy"
             style="width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
      : `<div style="width:38px;height:38px;border-radius:50%;background:${esc(bgColor)};
              display:flex;align-items:center;justify-content:center;
              font-size:15px;font-weight:600;color:#fff;flex-shrink:0;">${esc(initial)}</div>`;

    const timeAgoStr = p.lastVideo?.date ? timeAgoShort(p.lastVideo.date) : '';

    const card = document.createElement('div');
    card.className = 'scal-list-card';
    card.innerHTML = `
      <div class="scal-list-card-inner">
        ${avatarHtml}
        <div class="scal-list-card-body">
          <div class="scal-list-card-top">
            <span class="scal-list-card-name">${esc(p.channelName || 'Unknown')}</span>
            <span class="scal-conf-pill scal-conf-pill-${confLevel}">
              <span class="scal-conf-dot scal-conf-dot-${confLevel}"></span>
              ${confLabels[confLevel] || confLevel}
            </span>
          </div>
          <div class="scal-list-card-date">${timeStr} (estimated)</div>
          ${timeAgoStr ? `<div class="scal-list-card-sub">Last video: ${esc(timeAgoStr)}</div>` : ''}
        </div>
      </div>
      <div class="scal-list-card-expand" style="display:none;"></div>
    `;

    card.addEventListener('click', () => {
      const expandEl = card.querySelector('.scal-list-card-expand');
      if (expandedKeys.has(key)) {
        expandedKeys.delete(key);
        expandEl.style.display = 'none';
        expandEl.innerHTML = '';
      } else {
        expandedKeys.add(key);
        expandEl.style.display = '';
        renderExpanded(expandEl, p);
      }
    });

    return card;
  }

  /* ─── renderExpanded ──────────────────────────────────────── */
  function renderExpanded(el, p) {
    let statsHtml = '';
    if (p.stats) {
      const regularity = Math.round((1 - Math.min(p.stats.cv, 1)) * 100);
      statsHtml = `
        <div class="scal-detail-stats">
          <div class="scal-detail-stat">
            <div class="scal-detail-stat-label">Interval</div>
            <div class="scal-detail-stat-value">${Math.round(p.stats.medianIntervalDays)}d</div>
          </div>
          <div class="scal-detail-stat">
            <div class="scal-detail-stat-label">Videos</div>
            <div class="scal-detail-stat-value">${p.stats.videoCount}</div>
          </div>
          <div class="scal-detail-stat">
            <div class="scal-detail-stat-label">Regularity</div>
            <div class="scal-detail-stat-value">${regularity}%</div>
          </div>
        </div>
      `;
    }
    el.innerHTML = `
      ${p.explanation ? `<div class="scal-detail-explain">${esc(p.explanation)}</div>` : ''}
      ${statsHtml}
      ${p.lastVideo?.title
        ? `<div style="font-size:11px;color:var(--scal-text-muted);margin-top:8px;">
             Last: <em>${esc(p.lastVideo.title)}</em></div>`
        : ''}
    `;
  }

  /* ─── Helpers ─────────────────────────────────────────────── */
  function esc(str) {
    return SCAL.utils.escapeHtml(String(str));
  }

  window.SCAL.listView = {
    render,
    renderPredictions,
    showEmpty,
    showError,
  };
})();
