(() => {
  const themeButton = document.querySelector('.morning-theme-toggle');
  const themeMenu = document.querySelector('#mode-toggle + .dropdown-menu');
  if (themeButton && themeMenu) {
    const updateButton = () => {
      const isDark = document.documentElement.dataset.bsTheme === 'dark';
      themeButton.setAttribute('aria-pressed', String(isDark));
      themeButton.setAttribute('aria-label', isDark ? '切换浅色主题' : '切换深色主题');
    };
    new MutationObserver(updateButton).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-bs-theme']
    });
    themeButton.addEventListener('click', () => {
      const next = document.documentElement.dataset.bsTheme === 'dark' ? 'light' : 'dark';
      themeMenu.querySelector(`button[data-theme-mode="${next}"]`).click();
    });
    updateButton();
    themeButton.hidden = false;
  }

  const list = document.querySelector('.morning-list');
  if (list) {
    const entries = [...list.querySelectorAll('.morning-entry')];
    const button = document.querySelector('[data-show-more]');
    let visible = 3;
    entries.slice(visible).forEach(entry => { entry.hidden = true; });
    button.hidden = entries.length <= visible;
    button.addEventListener('click', () => {
      const batch = entries.slice(visible, visible + 3);
      batch.forEach(entry => { entry.hidden = false; });
      visible += batch.length;
      button.hidden = visible >= entries.length;
      batch[0].querySelector('h3 a').focus({ preventScroll: true });
    });
  }

  const hero = document.querySelector('.morning-hero');
  if (hero && matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) {
    const image = hero.querySelector('.morning-hero-image');
    hero.addEventListener('pointermove', event => {
      const bounds = hero.getBoundingClientRect();
      image.style.setProperty('--dx', `${((event.clientX - bounds.left) / bounds.width - .5) * -19}px`);
      image.style.setProperty('--dy', `${((event.clientY - bounds.top) / bounds.height - .5) * -13}px`);
    });
    hero.addEventListener('pointerleave', () => {
      image.style.removeProperty('--dx');
      image.style.removeProperty('--dy');
    });
  }
})();
