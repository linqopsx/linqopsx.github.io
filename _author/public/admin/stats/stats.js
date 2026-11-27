const $ = sel => document.querySelector(sel);
const els = {
  banner: $('[data-setup-banner]'),
  rangeText: $('[data-range-text]'),
  views: $('[data-kpi-views]'),
  visits: $('[data-kpi-visits]'),
  avg: $('[data-kpi-avg]'),
  subs: $('[data-kpi-subs]'),
  daysLabel: $('[data-kpi-days]'),
  chart: $('[data-daily-chart]'),
  paths: $('[data-table-paths]'),
  referers: $('[data-table-referers]'),
  devices: $('[data-table-devices]'),
  countries: $('[data-table-countries]'),
  refresh: $('[data-refresh]')
};

let currentDays = 7;
let titleMap = new Map();
const deviceNames = { desktop: '桌面电脑', mobile: '手机端', tablet: '平板电脑' };
const staticNames = {
  '/': '博客首页',
  '/archives/': '全部归档',
  '/categories/': '文章分类',
  '/tags/': '文章标签',
  '/downloads/': '软件下载',
  '/subscribe/': '订阅更新',
  '/about/': '关于我',
  '/admin/': '写作后台入口'
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function normalizePath(raw) {
  let p = String(raw || '/').split('?')[0].split('#')[0];
  try { p = decodeURIComponent(p); } catch { /* keep raw */ }
  if (!p.startsWith('/')) p = '/' + p;
  if (!p.endsWith('/')) p += '/';
  return p;
}

function resolvePageTitle(rawPath) {
  const norm = normalizePath(rawPath);
  if (titleMap.has(norm)) return titleMap.get(norm);
  if (staticNames[norm]) return staticNames[norm];
  const pageMatch = /^\/page(\d+)\/$/.exec(norm);
  if (pageMatch) return `博客首页（第 ${pageMatch[1]} 页）`;
  const catMatch = /^\/categories\/(.+)\/$/.exec(norm);
  if (catMatch) return `分类：${catMatch[1]}`;
  const tagMatch = /^\/tags\/(.+)\/$/.exec(norm);
  if (tagMatch) return `标签：#${tagMatch[1]}`;
  return norm;
}

async function loadTitleIndex() {
  try {
    const r = await fetch('/assets/js/data/search.json', { cache: 'no-cache' });
    if (!r.ok) return;
    const list = await r.json();
    if (!Array.isArray(list)) return;
    const next = new Map();
    for (const item of list) {
      if (item?.url && item?.title) {
        next.set(normalizePath(item.url), String(item.title));
      }
    }
    titleMap = next;
  } catch { /* fallback to raw path */ }
}

function barCell(val, total) {
  const pct = total > 0 ? Math.max(3, Math.round((val / total) * 100)) : 0;
  return `<td class="st-progress"><div class="st-progress-track"><div class="st-progress-fill" style="width:${pct}%"></div></div></td>`;
}

function renderChart(daily) {
  if (!daily?.length) {
    els.chart.innerHTML = '<p class="st-empty">该时间段暂无访问记录</p>';
    return;
  }
  const max = Math.max(1, ...daily.map(d => d.views));
  els.chart.innerHTML = daily.map(d => {
    const h = Math.max(4, Math.round((d.views / max) * 100));
    const shortDate = (d.label || '').slice(5);
    return `<div class="st-bar-col" title="${esc(d.label)}：${d.views} 次浏览 / ${d.visits} 访次">
      <span class="st-bar-num">${d.views}</span>
      <div class="st-bar-track"><div class="st-bar-fill" style="height:${h}%"></div></div>
      <span class="st-bar-date">${esc(shortDate)}</span>
    </div>`;
  }).join('');
}

function renderPaths(items, total) {
  if (!items?.length) {
    els.paths.innerHTML = '<tr><td colspan="5" class="st-empty">暂无页面访问数据</td></tr>';
    return;
  }
  els.paths.innerHTML = items.map((item, idx) => {
    const p = item.label || '/';
    const decoded = (() => { try { return decodeURIComponent(p); } catch { return p; } })();
    const title = resolvePageTitle(p);
    const showSub = title !== normalizePath(p) && title !== decoded;
    const href = `https://linqopsx.github.io${p.startsWith('/') ? p : '/' + p}`;
    return `<tr>
      <td class="st-rank">${idx + 1}</td>
      <td>
        <a class="st-path-title" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>
        ${showSub ? `<div class="st-path-sub">${esc(decoded)}</div>` : ''}
      </td>
      <td class="num">${item.views.toLocaleString()}</td>
      <td class="num">${item.visits.toLocaleString()}</td>
      ${barCell(item.views, total)}
    </tr>`;
  }).join('');
}

function renderSimpleTable(tbody, items, total, formatter = s => s) {
  if (!items?.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="st-empty">暂无数据</td></tr>';
    return;
  }
  tbody.innerHTML = items.map(item => `<tr>
    <td>${esc(formatter(item.label))}</td>
    <td class="num">${item.views.toLocaleString()}</td>
    ${barCell(item.views, total)}
  </tr>`).join('');
}

async function loadSubscribers() {
  try {
    const r = await fetch('https://theodore-blog-newsletter.theodore-blog-newsletter.workers.dev/subscriber-count', { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      if (Number.isSafeInteger(d.count)) els.subs.textContent = d.count.toLocaleString();
    }
  } catch { /* ignore */ }
}

async function loadStats() {
  els.refresh.disabled = true;
  els.rangeText.textContent = '正在读取统计数据…';
  try {
    const [res] = await Promise.all([
      fetch(`/api/stats?days=${currentDays}`, { credentials: 'same-origin', cache: 'no-store' }),
      titleMap.size ? Promise.resolve() : loadTitleIndex()
    ]);
    const data = await res.json().catch(() => ({}));
    if (data.configured === false) {
      els.banner.hidden = false;
      els.rangeText.textContent = '等待配置只读令牌 CF_ANALYTICS_TOKEN';
      els.chart.innerHTML = '<p class="st-empty">配置 CF_ANALYTICS_TOKEN 后将自动展示每日访问趋势图</p>';
      els.paths.innerHTML = '<tr><td colspan="5" class="st-empty">配置后展示热门文章与页面排行</td></tr>';
      els.referers.innerHTML = '<tr><td colspan="3" class="st-empty">等待配置</td></tr>';
      els.devices.innerHTML = '<tr><td colspan="3" class="st-empty">等待配置</td></tr>';
      els.countries.innerHTML = '<tr><td colspan="3" class="st-empty">等待配置</td></tr>';
      return;
    }
    if (!res.ok || data.error) throw new Error(data.error || `加载失败 (${res.status})`);
    els.banner.hidden = true;
    els.rangeText.textContent = `${data.startDate} ~ ${data.endDate}（近 ${data.days} 天）`;
    els.daysLabel.textContent = `近 ${data.days} 天累计`;
    els.views.textContent = (data.totalViews || 0).toLocaleString();
    els.visits.textContent = (data.totalVisits || 0).toLocaleString();
    els.avg.textContent = data.days ? Math.round((data.totalViews || 0) / data.days).toLocaleString() : '0';
    renderChart(data.daily);
    renderPaths(data.paths, data.totalViews);
    renderSimpleTable(els.referers, data.referers, data.totalViews, h => h || '直接访问 / 无来源');
    renderSimpleTable(els.devices, data.devices, data.totalViews, d => deviceNames[d] || d || '其他');
    renderSimpleTable(els.countries, data.countries, data.totalViews, c => c || '未知地区');
  } catch (err) {
    els.rangeText.textContent = `加载出错：${err.message}`;
  } finally {
    els.refresh.disabled = false;
  }
}

document.querySelectorAll('[data-days]').forEach(btn => {
  btn.addEventListener('click', () => {
    currentDays = Number(btn.dataset.days) === 30 ? 30 : 7;
    document.querySelectorAll('[data-days]').forEach(b => b.classList.toggle('is-active', b === btn));
    loadStats();
  });
});

els.refresh.addEventListener('click', () => { titleMap = new Map(); loadStats(); loadSubscribers(); });
loadStats();
loadSubscribers();
