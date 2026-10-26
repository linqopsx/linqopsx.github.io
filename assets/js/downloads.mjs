import { formatSize, loadAssets, markdownLink, normalizeAsset } from './downloads-core.mjs';

const root = document.querySelector('#software-downloads');
if (root) {
  const list = root.querySelector('[data-file-list]');
  const status = root.querySelector('[data-status]');
  const search = root.querySelector('[data-search]');
  const refresh = root.querySelector('[data-refresh]');
  const cacheKey = 'theodore-public-downloads-v1';
  let assets = [];
  const fromCatalog = items => items.map(a => normalizeAsset({ id: a.id, name: a.name, browser_download_url: a.url,
    state: 'uploaded', size: a.size, updated_at: a.updated, digest: a.digest })).filter(Boolean);
  async function catalog() {
    const response = await fetch('/assets/data/downloads.json', { cache: 'no-cache', credentials: 'omit', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('博客下载清单暂时无法加载，请稍后重试或直接打开 GitHub 下载页。');
    const data = await response.json();
    if (!Array.isArray(data.assets)) throw new Error('下载清单格式异常。');
    return fromCatalog(data.assets);
  }
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function cached() {
    try {
      const value = JSON.parse(sessionStorage.getItem(cacheKey));
      if (Date.now() - value.at > 60000 || value.at > Date.now() || !Array.isArray(value.assets)) return null;
      return fromCatalog(value.assets);
    } catch { return null; }
  }
  async function copy(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = '已复制，可以粘贴到文章中。';
    } catch {
      let input = button.parentElement.querySelector('textarea');
      if (!input) { input = node('textarea'); input.readOnly = true; input.setAttribute('aria-label', '待复制的下载链接'); button.parentElement.append(input); }
      input.value = text; input.focus(); input.select();
      status.textContent = '自动复制未成功，链接已选中，请按 Ctrl+C 复制。';
    }
  }
  function render() {
    const keyword = search.value.trim().toLocaleLowerCase();
    const visible = assets.filter(a => a.name.toLocaleLowerCase().includes(keyword));
    list.replaceChildren();
    root.querySelector('[data-count]').textContent = `${assets.length} 个文件`;
    if (!visible.length) {
      list.append(node('p', assets.length ? '没有找到匹配的文件，换个关键词试试。' : '还没有上传安装包。上传完成后，文件会自动出现在这里。', 'download-empty'));
      return;
    }
    for (const asset of visible) {
      const card = node('article', undefined, 'download-card');
      const info = node('div', undefined, 'download-info');
      info.append(node('h2', asset.name, 'download-name'));
      const date = new Date(asset.updated);
      info.append(node('p', formatSize(asset.size) + (Number.isNaN(date.getTime()) ? '' : ` · 更新于 ${date.toLocaleDateString('zh-CN', {timeZone: 'Asia/Shanghai'})}`), 'download-meta'));
      const actions = node('div', undefined, 'download-actions');
      const download = node('a', '下载安装包', 'download-primary');
      download.href = asset.url; download.rel = 'noopener noreferrer';
      actions.append(download);
      for (const [label, text] of [['复制链接', asset.url], ['复制文章链接', markdownLink(asset)]]) {
        const button = node('button', label); button.type = 'button';
        button.addEventListener('click', () => copy(text, button)); actions.append(button);
      }
      card.append(info, actions);
      if (asset.digest) {
        const details = node('details', undefined, 'download-checksum');
        details.append(node('summary', '查看 SHA-256 校验值'), node('code', asset.digest.slice(7)));
        card.append(details);
      }
      list.append(card);
    }
  }
  async function load(force = false) {
    refresh.disabled = true;
    status.textContent = '正在读取下载列表…';
    try {
      let fallback = false;
      if (force) {
        try { assets = await loadAssets(); }
        catch { assets = await catalog(); fallback = true; }
      } else {
        assets = cached();
        if (!assets) {
          try { assets = await catalog(); }
          catch { assets = await loadAssets(); }
        }
      }
      try { sessionStorage.setItem(cacheKey, JSON.stringify({at: Date.now(), assets})); } catch { /* Storage can be disabled. */ }
      render(); status.textContent = fallback ? '已显示博客备用清单；刚上传的文件可能需稍等发布完成。' : '列表已更新。';
    } catch (error) {
      status.textContent = error instanceof TypeError || error.name === 'TimeoutError' ? '暂时连接不到 GitHub，可稍后刷新或直接打开 GitHub 下载页。' : error.message;
    } finally { refresh.disabled = false; }
  }
  search.addEventListener('input', render);
  refresh.addEventListener('click', () => load(true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  load();
}
