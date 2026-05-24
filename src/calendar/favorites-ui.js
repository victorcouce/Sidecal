(function () {
  if (!window.SCAL) window.SCAL = {};

  const { t } = SCAL.i18n;
  const { escapeHtml } = SCAL.utils;

  let containerEl = null;
  let isLoading = false;

  async function renderFavorites(container) {
    containerEl = container;
    container.innerHTML = '';

    const [favorites, allChannels] = await Promise.all([
      SCAL.storage.getFavorites(),
      SCAL.channelDiscovery.fetchSubscriptions(),
    ]);

    const favIds = new Set(Object.keys(favorites));
    const selectedCount = favIds.size;

    const wrapper = document.createElement('div');
    wrapper.className = 'scal-favorites-view';

    wrapper.innerHTML = `
      <div class="scal-favorites-header">
        <h3 class="scal-favorites-title">${escapeHtml(t('yourFavoriteCreators'))}</h3>
        ${selectedCount > 0 ? `<span class="scal-selected-count">${selectedCount}</span>` : ''}
      </div>
      <div class="scal-search-box">
        <input type="text" class="scal-search-input" placeholder="${escapeHtml(t('searchChannelPlaceholder'))}" aria-label="${escapeHtml(t('searchChannel'))}">
      </div>
    `;

    const searchInput = wrapper.querySelector('.scal-search-input');
    let filteredChannels = allChannels;

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      filteredChannels = allChannels.filter(ch => ch.name.toLowerCase().includes(query));
      renderChannelList(wrapper, filteredChannels, favIds);
    });

    container.appendChild(wrapper);
    renderChannelList(wrapper, filteredChannels, favIds);

    const footer = document.createElement('div');
    footer.className = 'scal-favorites-footer';
    footer.innerHTML = `
      ${selectedCount > 0 ? `<button class="scal-btn scal-btn-secondary scal-clear-all">${escapeHtml(t('clearAll'))}</button>` : ''}
      <button class="scal-btn scal-btn-primary scal-back-btn">${escapeHtml(t('back'))}</button>
    `;

    if (selectedCount > 0) {
      footer.querySelector('.scal-clear-all').addEventListener('click', clearAll);
    }
    footer.querySelector('.scal-back-btn').addEventListener('click', hide);

    container.appendChild(footer);
  }

  function renderChannelList(wrapper, channels, favIds) {
    const existingList = wrapper.querySelector('.scal-channel-list');
    if (existingList) existingList.remove();

    const list = document.createElement('div');
    list.className = 'scal-channel-list';

    if (channels.length === 0) {
      list.innerHTML = `<div class="scal-no-results">${escapeHtml(t('noResults'))}</div>`;
      wrapper.appendChild(list);
      return;
    }

    channels.forEach(ch => {
      const isFav = favIds.has(ch.id);
      const item = document.createElement('div');
      item.className = 'scal-channel-item';

      const avatar = ch.avatar
        ? `<img class="scal-channel-avatar" src="${escapeHtml(ch.avatar)}" alt="" loading="lazy">`
        : `<div class="scal-channel-avatar scal-avatar-placeholder">${escapeHtml(ch.name.charAt(0).toUpperCase())}</div>`;

      item.innerHTML = `
        ${avatar}
        <span class="scal-channel-name">${escapeHtml(ch.name)}</span>
        <button class="scal-btn-toggle-fav ${isFav ? 'scal-is-favorite' : ''}" data-channel-id="${escapeHtml(ch.id)}" aria-label="${escapeHtml(isFav ? 'Remove favorite' : 'Add favorite')}">
          ${isFav ? '⭐' : '☆'}
        </button>
      `;

      item.querySelector('.scal-btn-toggle-fav').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(ch, e.target);
      });

      list.appendChild(item);
    });

    wrapper.appendChild(list);
  }

  async function toggleFavorite(channel, btn) {
    const isFav = btn.classList.contains('scal-is-favorite');

    if (isFav) {
      await SCAL.storage.removeFavorite(channel.id);
    } else {
      await SCAL.storage.addFavorite(channel);
    }

    btn.classList.toggle('scal-is-favorite');
    btn.textContent = btn.classList.contains('scal-is-favorite') ? '⭐' : '☆';
    btn.setAttribute('aria-label', btn.classList.contains('scal-is-favorite') ? 'Remove favorite' : 'Add favorite');

    const favorites = await SCAL.storage.getFavorites();
    const count = Object.keys(favorites).length;
    const countEl = containerEl?.querySelector('.scal-selected-count');
    if (count > 0) {
      if (!countEl) {
        const titleEl = containerEl?.querySelector('.scal-favorites-title');
        if (titleEl) {
          const newCount = document.createElement('span');
          newCount.className = 'scal-selected-count';
          newCount.textContent = count;
          titleEl.parentNode.insertBefore(newCount, titleEl.nextSibling);
        }
      } else {
        countEl.textContent = count;
      }
    } else if (countEl) {
      countEl.remove();
    }

    const footer = containerEl?.querySelector('.scal-favorites-footer');
    if (footer && count === 0 && footer.querySelector('.scal-clear-all')) {
      footer.querySelector('.scal-clear-all').remove();
    }
  }

  async function clearAll() {
    if (confirm('Clear all favorites?')) {
      await SCAL.storage.clearFavorites();
      const favorites = await SCAL.storage.getFavorites();
      const allChannels = await SCAL.channelDiscovery.fetchSubscriptions();
      renderFavorites(containerEl);
    }
  }

  function show(container) {
    renderFavorites(container);
  }

  function hide() {
    if (containerEl) {
      containerEl.innerHTML = '';
      SCAL.calendarUI.renderContent();
    }
  }

  window.SCAL.favoritesUI = {
    show,
    hide,
    renderFavorites,
  };
})();
