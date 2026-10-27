// Public per-article page views; no author credentials or browser identity are sent.
(async () => {
  const output = document.getElementById('post-view-count');
  if (!output) return;

  try {
    const response = await fetch('https://bsz.iirose.cn/api', {
      method: 'POST',
      headers: { 'x-bsz-referer': new URL(location.pathname, location.origin).href },
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Counter returned ${response.status}`);
    const result = await response.json();
    const views = result.data?.page_pv;
    if (result.success !== true || !Number.isSafeInteger(views) || views < 0) {
      throw new Error('Counter returned an invalid page view total');
    }
    output.textContent = views.toLocaleString('zh-CN');
  } catch (error) {
    output.parentElement.title = '阅读次数暂时无法加载，请稍后重试';
    console.warn('阅读次数暂时无法加载', error);
  }
})();
