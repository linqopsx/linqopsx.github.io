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
  document.querySelectorAll('.morning-navigation nav a, .ios-mobile-tabbar a').forEach(link => {
    const linkPath = new URL(link.href, location.origin).pathname.replace(/\/+$/, '') || '/';
    if (linkPath === currentPath) {
      link.setAttribute('aria-current', 'page');
    }
  });

  // POETIZE-style Typewriter Poetry in Hero
  const tw = document.querySelector('[data-typewriter]');
  if (tw && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const lines = [
      '写下 Agent 开发、编程工具与一路学到的东西。',
      '山高水长，把一路学到的东西慢慢写下来。',
      '代码是写给机器的逻辑，笔记是留给自己的光。',
      '保持好奇，认真折腾，慢慢成长。'
    ];
    let lineIdx = 0;
    let charIdx = lines[0].length;
    let deleting = false;
    const step = () => {
      const current = lines[lineIdx];
      if (!deleting) {
        if (charIdx < current.length) {
          charIdx += 1;
          tw.textContent = current.slice(0, charIdx);
          setTimeout(step, 85);
        } else {
          deleting = true;
          setTimeout(step, 2600);
        }
      } else if (charIdx > 0) {
        charIdx -= 1;
        tw.textContent = current.slice(0, charIdx);
        setTimeout(step, 42);
      } else {
        deleting = false;
        lineIdx = (lineIdx + 1) % lines.length;
        setTimeout(step, 400);
      }
    };
    setTimeout(step, 2400);
  }

  // Site Running Days in Footer
  const uptime = document.querySelector('[data-site-uptime]');
  if (uptime) {
    const start = new Date(`${uptime.dataset.siteUptime}T00:00:00+08:00`);
    const days = Math.max(1, Math.floor((Date.now() - start.getTime()) / 86400000) + 1);
    uptime.textContent = `本站已安静运行 ${days} 天`;
  }
})();
