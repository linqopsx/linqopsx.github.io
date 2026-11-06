(() => {
  const subtitle = document.querySelector('#sidebar .site-subtitle');
  const config = document.querySelector('script[data-subscriber-count]');
  if (!subtitle || !config) return;

  const badge = document.createElement('a');
  badge.className = 'subscriber-count';
  badge.href = '/subscribe/';
  badge.title = '已确认邮箱订阅的关注人数';
  badge.setAttribute('aria-live', 'polite');
  badge.textContent = '关注人数…';
  subtitle.after(badge);

  fetch(config.dataset.subscriberCount, { signal: AbortSignal.timeout(8000) })
    .then(response => {
      if (!response.ok) throw new Error('Subscriber count unavailable');
      return response.json();
    })
    .then(data => {
      if (!Number.isSafeInteger(data.count) || data.count < 0) throw new Error('Invalid subscriber count');
      badge.textContent = `${data.count.toLocaleString('zh-CN')} 人关注`;
    })
    .catch(() => {
      badge.textContent = '订阅更新';
      badge.title = '关注人数暂时无法加载，点击订阅博客更新';
    });
})();
