export const REPOSITORY = 'linqopsx/linqopsx.github.io';
export const RELEASE_TAG = 'blog-downloads';
export const RELEASE_PAGE = `https://github.com/${REPOSITORY}/releases/tag/${RELEASE_TAG}`;
export const UPLOAD_PAGE = `https://github.com/${REPOSITORY}/releases/edit/${RELEASE_TAG}`;
const API = `https://api.github.com/repos/${REPOSITORY}`;
const PREFIX = `https://github.com/${REPOSITORY}/releases/download/${RELEASE_TAG}/`;

export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '大小未知';
  if (bytes < 1024) return `${bytes} B`;
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  return `${(bytes / 1024 ** unit).toFixed(1)} ${['B', 'KB', 'MB', 'GB'][unit]}`;
}

export function normalizeAsset(asset) {
  if (asset.state !== 'uploaded' || !Number.isSafeInteger(asset.id) || !asset.name) return null;
  const url = String(asset.browser_download_url || '');
  if (!url.startsWith(PREFIX) || new URL(url).origin !== 'https://github.com') return null;
  return { id: asset.id, name: String(asset.name), url, size: Number(asset.size),
    updated: String(asset.updated_at || ''), digest: /^sha256:[a-f0-9]{64}$/i.test(asset.digest || '') ? asset.digest : '' };
}

export function markdownLink(asset) {
  const label = asset.name.replace(/[\\[\]]/g, '\\$&').replace(/[\r\n]/g, ' ');
  return `[下载 ${label}](<${asset.url.replace(/>/g, '%3E')}>)`;
}

export async function loadAssets(fetcher = fetch) {
  async function get(path) {
    const response = await fetcher(API + path, { headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(20000) });
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) throw new Error('GitHub 查询次数暂时用完，请稍后刷新，或直接打开 GitHub 下载页。');
      throw new Error(response.status === 404 ? '下载区正在准备中，请稍后刷新。' : `下载列表暂时无法加载（${response.status}），可直接打开 GitHub 下载页。`);
    }
    return response.json();
  }
  const release = await get(`/releases/tags/${RELEASE_TAG}`);
  if (release.draft || !Number.isSafeInteger(release.id)) throw new Error('下载区尚未公开。');
  const result = [];
  for (let page = 1; ; page++) {
    const assets = await get(`/releases/${release.id}/assets?per_page=100&page=${page}`);
    if (!Array.isArray(assets)) throw new Error('GitHub 返回了异常的下载列表。');
    result.push(...assets.map(normalizeAsset).filter(Boolean));
    if (assets.length < 100) break;
  }
  return result.sort((a, b) => b.updated.localeCompare(a.updated));
}
