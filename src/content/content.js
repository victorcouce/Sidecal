(function () {
  if (!window.SCAL) window.SCAL = {};

  let isInjected = false;
  let injectInterval = null;

  function tryInject() {
    if (document.querySelector('.scal-sidebar-entry')) {
      isInjected = true;
      stopInjectPolling();
      return;
    }

    const success = SCAL.sidebarEntry.inject();
    if (success) {
      isInjected = true;
      stopInjectPolling();
    }
  }

  function startInjectPolling() {
    if (injectInterval) return;
    injectInterval = setInterval(() => {
      if (isInjected && document.querySelector('.scal-sidebar-entry')) return;
      if (isInjected && !document.querySelector('.scal-sidebar-entry')) {
        isInjected = false;
      }
      tryInject();
    }, 500);
    tryInject();
  }

  function stopInjectPolling() {
    if (injectInterval) {
      clearInterval(injectInterval);
      injectInterval = null;
    }
  }

  document.addEventListener('yt-navigate-finish', () => {
    isInjected = false;
    startInjectPolling();
  });

  document.addEventListener('yt-page-data-updated', () => {
    if (!isInjected) startInjectPolling();
  });

  function init() {
    startInjectPolling();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
