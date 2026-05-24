(function () {
  if (!window.SCAL) window.SCAL = {};

  const CALENDAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="8" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="18" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="18" r="1" fill="currentColor" stroke="none"/></svg>`;

  function injectSidebarEntry() {
    if (document.querySelector('.scal-sidebar-entry')) return true;

    const guideContent = document.querySelector(
      '#guide-content, ytd-guide-renderer #sections'
    );
    if (!guideContent) return false;

    const sections = [...guideContent.querySelectorAll('ytd-guide-section-renderer')];
    if (sections.length === 0) return false;

    const entry = document.createElement('div');
    entry.className = 'scal-sidebar-entry';
    entry.setAttribute('role', 'button');
    entry.setAttribute('tabindex', '0');
    entry.setAttribute('aria-label', SCAL.i18n.t('calendar'));

    entry.innerHTML = `
      <span class="scal-sidebar-icon">${CALENDAR_SVG}</span>
      <span class="scal-sidebar-label">${SCAL.utils.escapeHtml(SCAL.i18n.t('calendar'))}</span>
    `;

    entry.addEventListener('click', () => {
      SCAL.calendarPanel.toggle();
    });

    entry.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        SCAL.calendarPanel.toggle();
      }
    });

    sections[0].insertAdjacentElement('afterend', entry);
    return true;
  }

  function cleanup() {
    document.querySelectorAll('.scal-sidebar-entry').forEach((el) => el.remove());
  }

  window.SCAL.sidebarEntry = {
    inject: injectSidebarEntry,
    cleanup,
  };
})();
