(function () {
  if (!window.SCAL) window.SCAL = {};

  const { t } = SCAL.i18n;
  const { escapeHtml, monthName } = SCAL.utils;

  let detailsOpen = false;

  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();
  let containerEl = null;

  const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfWeek(year, month) {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  }

  function isToday(year, month, day) {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
  }

  function renderMonth(container, year, month) {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfWeek(year, month);
    const today = new Date();

    let html = `
      <div class="scal-calendar">
        <div class="scal-calendar-nav">
          <button class="scal-btn-icon scal-nav-prev" aria-label="Previous month">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="scal-calendar-month-label">${escapeHtml(monthName(month))} ${year}</span>
          <button class="scal-btn-icon scal-nav-next" aria-label="Next month">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div class="scal-calendar-grid">
          <div class="scal-calendar-header">
    `;

    for (const dayKey of DAY_KEYS) {
      html += `<div class="scal-day-header">${escapeHtml(t(dayKey))}</div>`;
    }

    html += `</div><div class="scal-calendar-days">`;

    for (let i = 0; i < firstDay; i++) {
      html += `<div class="scal-day scal-day-empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const todayClass = isToday(year, month, d) ? ' scal-day-today' : '';
      const isPast = new Date(year, month, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const pastClass = isPast ? ' scal-day-past' : '';

      html += `
        <div class="scal-day${todayClass}${pastClass}" data-date="${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}">
          <span class="scal-day-number">${d}</span>
          <div class="scal-day-events"></div>
        </div>
      `;
    }

    html += `</div></div></div>`;

    container.innerHTML = html;

    container.querySelector('.scal-nav-prev').addEventListener('click', () => {
      navigateMonth(-1);
    });
    container.querySelector('.scal-nav-next').addEventListener('click', () => {
      navigateMonth(1);
    });
  }

  function navigateMonth(delta) {
    currentMonth += delta;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    } else if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    if (containerEl) {
      renderMonth(containerEl, currentYear, currentMonth);
      renderContent();
      // Re-render predictions after month change
      renderPredictionsAsync();
    }
  }

  async function renderPredictionsAsync() {
    try {
      const predictions = await SCAL.storage.getPredictions();
      const predList = Object.values(predictions);
      renderPredictions(predList);
    } catch (e) {
      console.warn('[SCAL] Error re-rendering predictions:', e.message);
    }
  }

  async function renderContent() {
    if (!containerEl) return;

    const favorites = await SCAL.storage.getFavorites();
    const favCount = Object.keys(favorites).length;

    const emptyEl = containerEl.querySelector('.scal-empty-state');
    if (emptyEl) emptyEl.remove();

    if (favCount === 0) {
      const empty = document.createElement('div');
      empty.className = 'scal-empty-state';
      empty.innerHTML = `
        <div class="scal-empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <p class="scal-empty-title">${escapeHtml(t('emptyCalendarTitle'))}</p>
        <p class="scal-empty-sub">${escapeHtml(t('emptyCalendarSub'))}</p>
        <button class="scal-btn scal-btn-primary scal-empty-action">${escapeHtml(t('addFavorites'))}</button>
      `;
      empty.querySelector('.scal-empty-action').addEventListener('click', () => {
        SCAL.favoritesUI.show(containerEl);
      });
      containerEl.appendChild(empty);
    }
  }

  function renderLoading(container) {
    const loading = document.createElement('div');
    loading.className = 'scal-loading';
    loading.innerHTML = `
      <div class="scal-spinner"></div>
      <span>${escapeHtml(t('loading'))}</span>
    `;
    return loading;
  }

  function renderError(container, message, retryFn) {
    const error = document.createElement('div');
    error.className = 'scal-error';
    error.innerHTML = `
      <div>${escapeHtml(message)}</div>
      ${retryFn ? `<button class="scal-btn scal-btn-secondary scal-error-retry" style="margin-top: 8px;">${escapeHtml(t('retry'))}</button>` : ''}
    `;
    if (retryFn) {
      error.querySelector('.scal-error-retry').addEventListener('click', retryFn);
    }
    return error;
  }

  function render(container) {
    containerEl = container;
    currentYear = new Date().getFullYear();
    currentMonth = new Date().getMonth();
    renderMonth(container, currentYear, currentMonth);
    renderContent();
  }

  function renderPredictions(predictions) {
    if (!containerEl) return;

    const days = containerEl.querySelectorAll('.scal-day');
    days.forEach(dayEl => {
      const dateAttr = dayEl.getAttribute('data-date');
      if (!dateAttr) return;

      const [year, month, day] = dateAttr.split('-').map(Number);
      const cellDate = new Date(year, month - 1, day);

      const eventContainer = dayEl.querySelector('.scal-day-events');
      if (!eventContainer) return;

      eventContainer.innerHTML = '';

      // Get predictions for this date
      const dayPredictions = predictions
        .filter(pred => {
          if (!pred.nextDates || pred.nextDates.length === 0) return false;
          return pred.nextDates.some(d => {
            const predDate = new Date(d.date);
            return predDate.getFullYear() === year &&
                   predDate.getMonth() === month - 1 &&
                   predDate.getDate() === day;
          });
        })
        .slice(0, 3);

      dayPredictions.forEach(pred => {
        const event = document.createElement('div');
        event.className = 'scal-event';

        const confidenceClass = `scal-confidence-dot-${pred.confidence?.level || 'low'}`;
        const avatar = pred.channelAvatar
          ? `<img class="scal-event-avatar" src="${escapeHtml(pred.channelAvatar)}" alt="" loading="lazy">`
          : `<div class="scal-event-avatar" style="background: var(--scal-chip); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 600;">${escapeHtml(pred.channelName?.charAt(0).toUpperCase() || '?')}</div>`;

        event.innerHTML = `
          ${avatar}
          <span class="scal-event-name">${escapeHtml(pred.channelName || 'Unknown')}</span>
          <span class="scal-confidence-dot ${confidenceClass}"></span>
        `;

        event.addEventListener('click', (e) => {
          e.stopPropagation();
          showPredictionDetail(pred);
        });

        eventContainer.appendChild(event);
      });

      // Show "+N more" if there are more predictions
      const totalCount = predictions.filter(pred => {
        if (!pred.nextDates || pred.nextDates.length === 0) return false;
        return pred.nextDates.some(d => {
          const predDate = new Date(d.date);
          return predDate.getFullYear() === year &&
                 predDate.getMonth() === month - 1 &&
                 predDate.getDate() === day;
        });
      }).length;

      if (totalCount > 3) {
        const moreEl = document.createElement('div');
        moreEl.className = 'scal-more-events';
        moreEl.textContent = `+${totalCount - 3} more`;
        eventContainer.appendChild(moreEl);
      }
    });
  }

  function showPredictionDetail(prediction) {
    if (!containerEl) return;

    // Remove any existing detail
    const existing = containerEl.querySelector('.scal-event-detail-overlay');
    if (existing) existing.remove();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'scal-event-detail-overlay';

    const detail = document.createElement('div');
    detail.className = 'scal-event-detail';

    const nextDate = prediction.nextDates?.[0];
    const dateStr = nextDate ? new Date(nextDate.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : 'Unknown date';

    const confidenceLabel = prediction.confidence?.level || 'low';
    const confidenceColor = {
      'high': 'var(--scal-confidence-high)',
      'medium': 'var(--scal-confidence-medium)',
      'low': 'var(--scal-confidence-low)',
    }[confidenceLabel] || 'var(--scal-text-muted)';

    const avatar = prediction.channelAvatar
      ? `<img class="scal-event-detail-avatar" src="${escapeHtml(prediction.channelAvatar)}" alt="" loading="lazy">`
      : `<div class="scal-event-detail-avatar" style="background: var(--scal-chip); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 600;">${escapeHtml(prediction.channelName?.charAt(0).toUpperCase() || '?')}</div>`;

    detail.innerHTML = `
      <div class="scal-event-detail-header">
        ${avatar}
        <div class="scal-event-detail-name">${escapeHtml(prediction.channelName || 'Unknown')}</div>
      </div>

      <div class="scal-event-detail-section">
        <strong>📅 ${escapeHtml(dateStr)}</strong>
      </div>

      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${confidenceColor};"></span>
        <span class="scal-event-detail-section" style="margin: 0;">
          <strong>${confidenceLabel.charAt(0).toUpperCase() + confidenceLabel.slice(1)} confidence</strong>
        </span>
      </div>

      <div class="scal-event-detail-explanation">
        ${escapeHtml(prediction.explanation || 'No explanation available.')}
      </div>

      ${prediction.stats ? `
        <div class="scal-event-detail-section">
          <strong>Statistics:</strong><br/>
          • Median interval: ${Math.round(prediction.stats.medianIntervalDays)} days<br/>
          • Coefficient of variation: ${(prediction.stats.cv * 100).toFixed(0)}%<br/>
          ${prediction.stats.preferredDays.length > 0 ? `• Preferred days: ${prediction.stats.preferredDays.join(', ')}<br/>` : ''}
          • Videos analyzed: ${prediction.stats.videoCount}
        </div>
      ` : ''}

      <div class="scal-event-detail-disclaimer">
        ⚠️ This is an estimate based on upload history. Not confirmed by YouTube or creators.
      </div>
    `;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });

    overlay.appendChild(detail);
    containerEl.appendChild(overlay);
  }

  window.SCAL.calendarUI = {
    render,
    renderMonth,
    renderContent,
    navigateMonth,
    renderPredictions,
    renderPredictionsAsync,
    showPredictionDetail,
    renderLoading,
    renderError,
  };
})();
