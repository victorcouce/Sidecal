(function () {
  if (!window.SCAL) window.SCAL = {};

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(value ?? '')));
    return div.innerHTML;
  }

  function isSubscriptionsPage() {
    return location.pathname === '/feed/subscriptions';
  }

  function isWatchPage() {
    return location.pathname.startsWith('/watch');
  }

  function isChannelPage() {
    return /^\/(@|channel\/|c\/|user\/)/.test(location.pathname);
  }

  function formatDate(date) {
    if (!(date instanceof Date)) date = new Date(date);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatTimeAgo(date) {
    if (!(date instanceof Date)) date = new Date(date);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 1) return SCAL.i18n.t('today');
    if (diffDays < 7) return SCAL.i18n.count('daysAgo', diffDays);
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 5) return SCAL.i18n.count('weeksAgo', diffWeeks);
    const diffMonths = Math.floor(diffDays / 30.44);
    return SCAL.i18n.count('monthsAgo', diffMonths);
  }

  const MONTH_KEYS = [
    'januaryFull', 'februaryFull', 'marchFull', 'aprilFull',
    'mayFull', 'juneFull', 'julyFull', 'augustFull',
    'septemberFull', 'octoberFull', 'novemberFull', 'decemberFull',
  ];

  function monthName(monthIndex) {
    return SCAL.i18n.t(MONTH_KEYS[monthIndex]);
  }

  window.SCAL.utils = {
    escapeHtml,
    isSubscriptionsPage,
    isWatchPage,
    isChannelPage,
    formatDate,
    formatTimeAgo,
    monthName,
  };
})();
