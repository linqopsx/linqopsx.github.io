(() => {
  const themeButton = document.querySelector('.morning-theme-toggle');
  const themeMenu = document.querySelector('#mode-toggle + .dropdown-menu');
  const modeToggle = document.querySelector('#mode-toggle');

  if (themeButton && (themeMenu || modeToggle)) {
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
      const menuBtn = themeMenu?.querySelector(`button[data-theme-mode="${next}"]`);
      if (menuBtn) {
        menuBtn.click();
      } else if (modeToggle) {
        modeToggle.click();
      }
    });
    updateButton();
    themeButton.hidden = false;
  }

  const currentPath = location.pathname.replace(/\/+$/, '') || '/';
  document.querySelectorAll('.morning-navigation nav a').forEach(link => {
    const linkPath = new URL(link.href, location.origin).pathname.replace(/\/+$/, '') || '/';
    if (linkPath === currentPath) {
      link.setAttribute('aria-current', 'page');
    }
  });
})();
