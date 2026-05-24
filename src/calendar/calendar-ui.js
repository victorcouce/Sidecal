/* ═══════════════════════════════════════════════════════════
   calendar-ui.js — Calendar grid + inline detail card
═══════════════════════════════════════════════════════════ */
(function () {
  if (!window.SCAL) window.SCAL = {};

  const { escapeHtml } = SCAL.utils;

  let containerEl       = null;
  let currentYear       = new Date().getFullYear();
  let currentMonth      = new Date().getMonth();
  let selectedChannelId = null; // tracks open detail card

  const DAY_KEYS   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  /* ─── Helpers ────────────────────────────────────────────── */
  function getDaysInMonth(y, m)  { return new Date(y, m + 1, 0).getDate(); }
  function getFirstDayOfWeek(y, m) {
    const d = new Date(y, m, 1).getDay();
    return d === 0 ? 6 : d - 1; // Monday-first
  }
  function isToday(y, m, d) {
    const n = new Date();
    return n.getFullYear() === y && n.getMonth() === m && n.getDate() === d;
  }

  function formatPredDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
  }

  function timeAgo(iso) {
    const ms   = Date.now() - new Date(iso).getTime();
    const days = Math.floor(ms / 86400000);
    if (days < 1)   return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7)   return `${days} days ago`;
    const w = Math.floor(days / 7);
    return w === 1 ? '1 week ago' : `${w} weeks ago`;
  }

  /* ─── renderMonth ────────────────────────────────────────── */
  function renderMonth(container, year, month) {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay    = getFirstDayOfWeek(year, month);
    const today       = new Date();

    let html = `
      <div class="scal-calendar">
        <div class="scal-calendar-nav">
          <button class="scal-btn-icon scal-nav-prev" aria-label="Previous month">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span class="scal-calendar-month-label">${MONTH_NAMES[month]} ${year}</span>
          <button class="scal-btn-icon scal-nav-next" aria-label="Next month">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
        <div class="scal-calendar-grid">
          <div class="scal-calendar-header">
    `;

    DAY_KEYS.forEach(d => { html += `<div class="scal-day-header">${escapeHtml(d)}</div>`; });
    html += `</div><div class="scal-calendar-days">`;

    for (let i = 0; i < firstDay; i++) {
      html += `<div class="scal-day scal-day-empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const todayCls = isToday(year, month, d) ? ' scal-day-today' : '';
      const pastCls  = new Date(year, month, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate())
        ? ' scal-day-past' : '';
      html += `
        <div class="scal-day${todayCls}${pastCls}"
             data-date="${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}">
          <span class="scal-day-number">${d}</span>
          <div class="scal-day-events"></div>
        </div>
      `;
    }

    html += `</div></div></div>`;
    container.innerHTML = html;

    container.querySelector('.scal-nav-prev').addEventListener('click', () => navigateMonth(-1));
    container.querySelector('.scal-nav-next').addEventListener('click', () => navigateMonth(1));
  }

  /* ─── navigateMonth ──────────────────────────────────────── */
  function navigateMonth(delta) {
    currentMonth += delta;
    if (currentMonth < 0)  { currentMonth = 11; currentYear--; }
    if (currentMonth > 11) { currentMonth = 0;  currentYear++; }
    selectedChannelId = null;
    if (containerEl) {
      renderMonth(containerEl, currentYear, currentMonth);
      renderPredictionsAsync();
    }
  }

  /* ─── render (entry point from panel) ───────────────────── */
  function render(container) {
    containerEl   = container;
    currentYear   = new Date().getFullYear();
    currentMonth  = new Date().getMonth();
    selectedChannelId = null;
    renderMonth(container, currentYear, currentMonth);
    // Predictions are loaded and injected by the panel via renderPredictions()
  }

  /* ─── showEmpty ──────────────────────────────────────────── */
  function showEmpty(onAddCreators) {
    if (!containerEl) return;
    // Remove any existing empty state
    containerEl.querySelector('.scal-empty-state')?.remove();

    const empty = document.createElement('div');
    empty.className = 'scal-empty-state';
    empty.innerHTML = `
      <div class="scal-empty-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </div>
      <p class="scal-empty-title">No favorites yet</p>
      <p class="scal-empty-sub">Add favorite creators to see predicted upload dates on the calendar.</p>
      <button class="scal-btn scal-btn-primary scal-empty-action">Add Creators</button>
    `;
    empty.querySelector('.scal-empty-action').addEventListener('click', onAddCreators);
    containerEl.appendChild(empty);
  }

  /* ─── showError ──────────────────────────────────────────── */
  function showError(onRetry) {
    if (!containerEl) return;
    containerEl.querySelector('.scal-error')?.remove();
    const err = document.createElement('div');
    err.className = 'scal-error';
    err.innerHTML = `
      <div>Could not load predictions.</div>
      <button class="scal-btn scal-btn-secondary scal-error-retry" style="margin-top: 8px;">Retry</button>
    `;
    err.querySelector('.scal-error-retry').addEventListener('click', onRetry);
    containerEl.appendChild(err);
  }

  /* ─── renderPredictions ──────────────────────────────────── */
  function renderPredictions(predictions) {
    if (!containerEl) return;

    const days = containerEl.querySelectorAll('.scal-day[data-date]');
    days.forEach(dayEl => {
      const dateAttr = dayEl.getAttribute('data-date');
      if (!dateAttr) return;

      const [year, month, day] = dateAttr.split('-').map(Number);
      const eventContainer     = dayEl.querySelector('.scal-day-events');
      if (!eventContainer) return;
      eventContainer.innerHTML = '';

      // Predictions landing on this day
      const dayPreds = predictions.filter(pred =>
        (pred.nextDates || []).some(d => {
          const pd = new Date(d.date);
          return pd.getFullYear() === year &&
                 pd.getMonth()    === month - 1 &&
                 pd.getDate()     === day;
        })
      );

      dayPreds.slice(0, 3).forEach(pred => {
        const confLevel = pred.confidence?.level || 'low';
        const bgColor   = pred.channelColor || '#888';
        const initial   = (pred.channelName || '?').charAt(0).toUpperCase();

        const eventEl = document.createElement('div');
        eventEl.className = 'scal-event';

        const avatarHtml = pred.channelAvatar
          ? `<img class="scal-event-avatar" src="${escapeHtml(pred.channelAvatar)}" alt="" loading="lazy">`
          : `<div class="scal-event-avatar"
                  style="background:${escapeHtml(bgColor)};display:flex;
                         align-items:center;justify-content:center;
                         font-size:8px;font-weight:700;color:#fff;">
               ${escapeHtml(initial)}
             </div>`;

        eventEl.innerHTML = `
          ${avatarHtml}
          <span class="scal-event-name">${escapeHtml(pred.channelName || 'Unknown')}</span>
          <span class="scal-confidence-dot scal-confidence-dot-${confLevel}"></span>
        `;

        eventEl.addEventListener('click', e => {
          e.stopPropagation();
          showPredictionDetail(pred);
        });

        eventContainer.appendChild(eventEl);
      });

      if (dayPreds.length > 3) {
        const more = document.createElement('div');
        more.className = 'scal-more-events';
        more.textContent = `+${dayPreds.length - 3} more`;
        eventContainer.appendChild(more);
      }
    });
  }

  /* ─── renderPredictionsAsync (used by navigateMonth) ──────── */
  async function renderPredictionsAsync() {
    try {
      const stored   = await SCAL.storage.getPredictions();
      renderPredictions(Object.values(stored));
    } catch (e) {
      console.warn('[SCAL] renderPredictionsAsync error:', e.message);
    }
  }

  /* ─── showPredictionDetail (inline card) ─────────────────── */
  function showPredictionDetail(prediction) {
    if (!containerEl) return;

    // Toggle: clicking same channel again closes the card
    if (selectedChannelId === prediction.channelId) {
      containerEl.querySelector('.scal-detail-card')?.remove();
      selectedChannelId = null;
      return;
    }

    selectedChannelId = prediction.channelId;
    containerEl.querySelector('.scal-detail-card')?.remove();

    const p           = prediction;
    const confLevel   = p.confidence?.level || 'low';
    const confLabels  = { high: 'High', medium: 'Medium', low: 'Low', insufficient_data: 'No data' };
    const nextDate    = p.nextDates?.[0];
    const dateStr     = nextDate ? formatPredDate(nextDate.date) : 'Unknown';
    const bgColor     = p.channelColor || '#888';
    const initial     = (p.channelName || '?').charAt(0).toUpperCase();

    const avatarHtml = p.channelAvatar
      ? `<img src="${escapeHtml(p.channelAvatar)}" alt="" loading="lazy"
             style="width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
      : `<div style="width:38px;height:38px;border-radius:50%;background:${escapeHtml(bgColor)};
              display:flex;align-items:center;justify-content:center;
              font-size:15px;font-weight:600;color:#fff;flex-shrink:0;">${escapeHtml(initial)}</div>`;

    let statsHtml = '';
    if (p.stats) {
      const reg = Math.round((1 - Math.min(p.stats.cv, 1)) * 100);
      const prefDays = (p.stats.preferredDays || []).join(', ');
      statsHtml = `
        <div class="scal-detail-stats">
          <div class="scal-detail-stat">
            <div class="scal-detail-stat-label">Interval</div>
            <div class="scal-detail-stat-value">${Math.round(p.stats.medianIntervalDays)} days</div>
          </div>
          <div class="scal-detail-stat">
            <div class="scal-detail-stat-label">Videos</div>
            <div class="scal-detail-stat-value">${p.stats.videoCount}</div>
          </div>
          <div class="scal-detail-stat">
            <div class="scal-detail-stat-label">Regularity</div>
            <div class="scal-detail-stat-value">${reg}%</div>
          </div>
          ${prefDays ? `
          <div class="scal-detail-stat">
            <div class="scal-detail-stat-label">Usual days</div>
            <div class="scal-detail-stat-value" style="font-size:12px;">${escapeHtml(prefDays)}</div>
          </div>` : ''}
        </div>
      `;
    }

    const card = document.createElement('div');
    card.className = 'scal-detail-card';
    card.innerHTML = `
      <div class="scal-detail-card-header">
        <div class="scal-detail-card-ch">
          ${avatarHtml}
          <div style="min-width:0;">
            <div class="scal-detail-card-name">${escapeHtml(p.channelName || 'Unknown')}</div>
            <div style="margin-top:4px;">
              <span class="scal-conf-pill scal-conf-pill-${confLevel}">
                <span class="scal-conf-dot scal-conf-dot-${confLevel}"></span>
                ${confLabels[confLevel] || confLevel}
              </span>
            </div>
          </div>
        </div>
        <button class="scal-btn-icon scal-detail-close" aria-label="Close" style="flex-shrink:0;margin-top:-4px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="scal-detail-card-row">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span><strong>Next expected:</strong> ${escapeHtml(dateStr)}</span>
      </div>

      ${p.lastVideo ? `
      <div class="scal-detail-card-row">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>Last video: ${escapeHtml(timeAgo(p.lastVideo.date))}
          ${p.lastVideo.title ? `— <em>${escapeHtml(p.lastVideo.title)}</em>` : ''}</span>
      </div>` : ''}

      ${p.explanation ? `<div class="scal-detail-explain">${escapeHtml(p.explanation)}</div>` : ''}
      ${statsHtml}
    `;

    card.querySelector('.scal-detail-close').addEventListener('click', e => {
      e.stopPropagation();
      card.remove();
      selectedChannelId = null;
    });

    // Append after the calendar grid (inside containerEl)
    containerEl.appendChild(card);
  }

  /* ─── Public API ─────────────────────────────────────────── */
  window.SCAL.calendarUI = {
    render,
    renderMonth,
    navigateMonth,
    renderPredictions,
    renderPredictionsAsync,
    showPredictionDetail,
    showEmpty,
    showError,
  };
})();
