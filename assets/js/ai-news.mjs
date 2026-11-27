const root = document.querySelector('#ai-news-app');
if (root) {
  const urlOverride = new URLSearchParams(location.search).get('api');
  const API_BASE = (urlOverride || root.dataset.apiBase || '').replace(/\/+$/, '');
  const STATIC_URL = root.dataset.staticData || '/assets/ai-news/data.json';
  const STATIC_RSS = root.dataset.rssUrl || '/assets/ai-news/feed.xml';
  const USE_STATIC = !API_BASE;

  // Dedicated LLM Model Pagination Tabs
  const MODEL_TABS = [
    { id: 'all', label: '全部大模型', color: '#007aff', aliases: [] },
    { id: 'openai', label: 'OpenAI / GPT', color: '#10a37f', aliases: ['OpenAI', 'GPT', 'ChatGPT', 'o1', 'o3'] },
    { id: 'gemini', label: 'Google Gemini', color: '#4285f4', aliases: ['Gemini', 'Google', 'DeepMind', 'Gemma'] },
    { id: 'claude', label: 'Claude', color: '#d97706', aliases: ['Claude', 'Anthropic'] },
    { id: 'deepseek', label: 'DeepSeek', color: '#2563eb', aliases: ['DeepSeek'] },
    { id: 'qwen', label: '通义 Qwen', color: '#6366f1', aliases: ['Qwen', '通义千问', '通义', 'Alibaba'] },
    { id: 'seed', label: '字节 Seed', color: '#06b6d4', aliases: ['Seed', '豆包', 'ByteDance', '字节'] },
    { id: 'zhipu', label: '智谱 GLM', color: '#8b5cf6', aliases: ['GLM', '智谱', 'Zhipu'] },
    { id: 'kimi', label: 'Kimi', color: '#ec4899', aliases: ['Kimi', '月之暗面', 'Moonshot'] },
    { id: 'hunyuan', label: '腾讯混元', color: '#14b8a6', aliases: ['混元', 'Hunyuan', 'Tencent', '腾讯'] }
  ];

  const CATEGORY_NAMES = {
    official: '官方动态',
    research: '前沿研究',
    media: '深度报道',
    community: '开源社区'
  };

  const state = {
    modelId: 'all',
    source: '',
    region: '',
    priority: '',
    tag: '',
    q: '',
    page: 1,
    pageSize: 20,
    total: 0,
    metaTags: [],
    staticArticles: [],
    generatedAt: ''
  };

  const els = {
    rss: root.querySelector('[data-rss-link]'),
    digestBox: root.querySelector('[data-digest-box]'),
    digestDate: root.querySelector('[data-digest-date]'),
    digestTitle: root.querySelector('[data-digest-title]'),
    digestBody: root.querySelector('[data-digest-body]'),
    modelTabs: root.querySelector('[data-model-tabs]'),
    sourceSeg: root.querySelector('[data-filter-source]'),
    regionSeg: root.querySelector('[data-filter-region]'),
    prioritySeg: root.querySelector('[data-filter-priority]'),
    search: root.querySelector('[data-search]'),
    hotTags: root.querySelector('[data-hot-tags]'),
    summary: root.querySelector('[data-result-summary]'),
    clearBtn: root.querySelector('[data-clear-filters]'),
    list: root.querySelector('[data-article-list]'),
    pager: root.querySelector('[data-pager]'),
    prevBtn: root.querySelector('[data-prev-page]'),
    nextBtn: root.querySelector('[data-next-page]'),
    pageInfo: root.querySelector('[data-page-info]')
  };

  if (els.rss) els.rss.href = USE_STATIC ? STATIC_RSS : `${API_BASE}/feed.xml`;

  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function isXArticle(article) {
    const name = String(article?.source_name || '').trim();
    const url = String(article?.source_url || '').toLowerCase();
    return name.startsWith('X · ') || name.startsWith('X·') || /(?:^|\/\/|\.)x\.com(?:\/|$)/.test(url);
  }

  function formatTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d);
  }

  function renderSimpleMd(md) {
    let html = esc(md || '');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    const lines = html.split(/\r?\n/);
    const out = [];
    let inList = false;
    for (const line of lines) {
      const hm = /^\s*#{1,4}\s+(.+)$/.exec(line);
      const m = /^\s*[-*]\s+(.+)$/.exec(line);
      if (hm) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<p><strong>${hm[1]}</strong></p>`);
      } else if (m) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push(`<li>${m[1]}</li>`);
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        if (line.trim()) out.push(`<p>${line.trim()}</p>`);
      }
    }
    if (inList) out.push('</ul>');
    return out.join('');
  }

  function articleMatchesModel(article, model) {
    if (!model || model.id === 'all') return true;
    const aliases = model.aliases.map(a => a.toLowerCase());
    const hay = [
      article.title_zh || '',
      article.summary_one_liner || '',
      article.source_name || '',
      ...(Array.isArray(article.tags) ? article.tags : [])
    ].join(' ').toLowerCase();
    return aliases.some(alias => hay.includes(alias));
  }

  function matchModelTag(model) {
    if (!model || model.id === 'all') return { tag: '', qFallback: '', count: USE_STATIC ? state.staticArticles.length : null };
    if (USE_STATIC) {
      const count = state.staticArticles.filter(a => articleMatchesModel(a, model)).length;
      return { tag: '', qFallback: '', count };
    }
    const lowerMap = new Map(state.metaTags.map(t => [t.name.toLowerCase(), t]));
    for (const alias of model.aliases) {
      const hit = lowerMap.get(alias.toLowerCase());
      if (hit) return { tag: hit.name, qFallback: '', count: hit.count };
    }
    return { tag: '', qFallback: model.aliases[0] || model.label, count: null };
  }

  function renderModelTabs() {
    els.modelTabs.replaceChildren();
    for (const model of MODEL_TABS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.role = 'tab';
      btn.className = `ainews-model-tab${state.modelId === model.id ? ' is-active' : ''}`;
      btn.setAttribute('aria-selected', String(state.modelId === model.id));
      const matched = matchModelTag(model);
      const countHtml = matched.count != null && matched.count > 0 ? `<span class="ainews-model-count">${matched.count}</span>` : '';
      btn.innerHTML = `<span class="ainews-model-dot" style="background:${model.color}" aria-hidden="true"></span><span>${esc(model.label)}</span>${countHtml}`;
      btn.addEventListener('click', () => {
        if (state.modelId === model.id) return;
        state.modelId = model.id;
        state.tag = '';
        state.page = 1;
        renderModelTabs();
        renderHotTags();
        loadArticles();
      });
      els.modelTabs.append(btn);
    }
  }

  function renderHotTags() {
    const top = state.metaTags.slice(0, 12);
    if (!top.length) {
      els.hotTags.hidden = true;
      return;
    }
    els.hotTags.hidden = false;
    els.hotTags.replaceChildren();
    for (const item of top) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ainews-tag-chip${state.tag.toLowerCase() === item.name.toLowerCase() ? ' is-active' : ''}`;
      btn.textContent = `#${item.name} · ${item.count}`;
      btn.addEventListener('click', () => {
        state.tag = state.tag.toLowerCase() === item.name.toLowerCase() ? '' : item.name;
        if (state.tag) state.modelId = 'all';
        state.page = 1;
        renderModelTabs();
        renderHotTags();
        loadArticles();
      });
      els.hotTags.append(btn);
    }
  }

  function showSkeletons() {
    els.list.innerHTML = '<div class="ainews-skeleton"></div><div class="ainews-skeleton"></div><div class="ainews-skeleton"></div>';
  }

  function hasActiveFilters() {
    return Boolean(state.modelId !== 'all' || state.source || state.region || state.priority || state.tag || state.q);
  }

  function clearFilters() {
    state.modelId = 'all';
    state.source = '';
    state.region = '';
    state.priority = '';
    state.tag = '';
    state.q = '';
    state.page = 1;
    els.search.value = '';
    els.sourceSeg?.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b.dataset.val === ''));
    els.regionSeg.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b.dataset.val === ''));
    els.prioritySeg.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b.dataset.val === ''));
    renderModelTabs();
    renderHotTags();
    loadArticles();
  }

  function renderArticles(data) {
    const items = Array.isArray(data?.items) ? data.items : [];
    state.total = Number(data?.total || 0);
    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    const currentModel = MODEL_TABS.find(m => m.id === state.modelId);
    const updatedHint = state.generatedAt ? ` · 更新于 ${formatTime(state.generatedAt)}` : '';
    els.summary.textContent = `${currentModel?.label || '全部大模型'} · 共 ${state.total} 条资讯${updatedHint}`;
    els.clearBtn.hidden = !hasActiveFilters();

    if (!items.length) {
      els.list.innerHTML = `<div class="ainews-state-box">
        <p>当前筛选条件下暂无 AI 资讯。</p>
        ${hasActiveFilters() ? '<button type="button" class="ainews-state-btn" data-empty-clear>清空筛选</button>' : ''}
      </div>`;
      els.list.querySelector('[data-empty-clear]')?.addEventListener('click', clearFilters);
      els.pager.hidden = true;
      return;
    }

    els.list.replaceChildren();
    for (const a of items) {
      const card = document.createElement('article');
      card.className = 'ainews-card';
      const pClass = String(a.priority).toUpperCase() === 'P0' ? 'is-p0' : 'is-p1';
      const pLabel = String(a.priority).toUpperCase() === 'P0' ? 'P0 重磅' : 'P1 值得看';
      const isX = isXArticle(a);
      const xBadgeHtml = isX ? '<span class="ainews-x-badge" title="来自 X (Twitter)" aria-label="X 动态">𝕏</span>' : '';
      const displaySource = isX ? String(a.source_name || '').replace(/^X\s*·\s*/, '') : String(a.source_name || '');
      const regionLabel = a.region === 'cn' ? '国内' : '海外';
      const catLabel = CATEGORY_NAMES[a.category] || a.category || '';
      const highlightsHtml = Array.isArray(a.highlights) && a.highlights.length
        ? `<ul class="ainews-highlights">${a.highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul>`
        : '';
      const commentaryHtml = a.commentary
        ? `<blockquote class="ainews-commentary">${esc(a.commentary)}</blockquote>`
        : '';

      card.innerHTML = `
        <div class="ainews-card-meta">
          <span class="ainews-priority ${pClass}">${pLabel}</span>
          ${xBadgeHtml}
          <span>${esc(displaySource)}</span>
          <span class="ainews-region-pill">${regionLabel}</span>
          ${catLabel ? `<span>${esc(catLabel)}</span>` : ''}
          <time datetime="${esc(a.published_at || '')}">${esc(formatTime(a.published_at))}</time>
        </div>
        <h3 class="ainews-card-title">
          <a href="${esc(a.source_url || '#')}" target="_blank" rel="noopener noreferrer">${esc(a.title_zh || '无标题')} ↗</a>
        </h3>
        ${a.summary_one_liner ? `<p class="ainews-summary">${esc(a.summary_one_liner)}</p>` : ''}
        ${highlightsHtml}
        ${commentaryHtml}
        <div class="ainews-card-tags" data-card-tags></div>
      `;

      const tagWrap = card.querySelector('[data-card-tags]');
      if (Array.isArray(a.tags) && a.tags.length) {
        for (const t of a.tags) {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = `ainews-tag-chip${state.tag.toLowerCase() === String(t).toLowerCase() ? ' is-active' : ''}`;
          chip.textContent = `#${t}`;
          chip.addEventListener('click', () => {
            state.tag = String(t);
            state.modelId = 'all';
            state.page = 1;
            renderModelTabs();
            renderHotTags();
            loadArticles();
            root.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
          tagWrap.append(chip);
        }
      }
      els.list.append(card);
    }

    els.pager.hidden = totalPages <= 1;
    els.prevBtn.disabled = state.page <= 1;
    els.nextBtn.disabled = state.page >= totalPages;
    els.pageInfo.textContent = `第 ${state.page} / ${totalPages} 页`;
  }

  function queryStaticArticles() {
    const activeModel = MODEL_TABS.find(m => m.id === state.modelId);
    const qLower = state.q.toLowerCase();
    const tagLower = state.tag.toLowerCase();
    const filtered = state.staticArticles.filter(a => {
      if (state.source === 'x' && !isXArticle(a)) return false;
      if (state.source === 'blog' && isXArticle(a)) return false;
      if (state.region && a.region !== state.region) return false;
      if (state.priority && String(a.priority).toUpperCase() !== state.priority.toUpperCase()) return false;
      if (tagLower) {
        const tags = Array.isArray(a.tags) ? a.tags.map(t => String(t).toLowerCase()) : [];
        if (!tags.includes(tagLower)) return false;
      } else if (activeModel && activeModel.id !== 'all') {
        if (!articleMatchesModel(a, activeModel)) return false;
      }
      if (qLower) {
        const hay = `${a.title_zh || ''} ${a.summary_one_liner || ''} ${a.source_name || ''}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });
    const start = (state.page - 1) * state.pageSize;
    renderArticles({ total: filtered.length, page: state.page, page_size: state.pageSize, items: filtered.slice(start, start + state.pageSize) });
  }

  async function loadArticles() {
    if (USE_STATIC) {
      queryStaticArticles();
      return;
    }
    showSkeletons();
    const params = new URLSearchParams({
      page: String(state.page),
      page_size: String(state.pageSize)
    });
    if (state.region) params.set('region', state.region);
    if (state.priority) params.set('priority', state.priority);

    const activeModel = MODEL_TABS.find(m => m.id === state.modelId);
    const modelQuery = matchModelTag(activeModel);
    if (state.tag) {
      params.set('tag', state.tag);
    } else if (modelQuery.tag) {
      params.set('tag', modelQuery.tag);
    }
    const effectiveQ = state.q || (!state.tag ? modelQuery.qFallback : '');
    if (effectiveQ) params.set('q', effectiveQ);

    try {
      const res = await fetch(`${API_BASE}/articles?${params.toString()}`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`接口返回 ${res.status}`);
      renderArticles(await res.json());
    } catch {
      els.summary.textContent = '资讯服务暂时无法连接';
      els.pager.hidden = true;
      els.list.innerHTML = `<div class="ainews-state-box">
        <p>未能连接到 AI 资讯后端（<code>${esc(API_BASE)}</code>）。</p>
        <button type="button" class="ainews-state-btn" data-retry>重新加载</button>
      </div>`;
      els.list.querySelector('[data-retry]')?.addEventListener('click', loadArticles);
    }
  }

  // Filter Events
  els.sourceSeg?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-val]');
    if (!btn) return;
    state.source = btn.dataset.val;
    state.page = 1;
    els.sourceSeg.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b === btn));
    loadArticles();
  });

  els.regionSeg.addEventListener('click', e => {
    const btn = e.target.closest('button[data-val]');
    if (!btn) return;
    state.region = btn.dataset.val;
    state.page = 1;
    els.regionSeg.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b === btn));
    loadArticles();
  });

  els.prioritySeg.addEventListener('click', e => {
    const btn = e.target.closest('button[data-val]');
    if (!btn) return;
    state.priority = btn.dataset.val;
    state.page = 1;
    els.prioritySeg.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b === btn));
    loadArticles();
  });

  let searchTimer = null;
  els.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = els.search.value.trim();
      state.page = 1;
      loadArticles();
    }, 300);
  });

  els.clearBtn.addEventListener('click', clearFilters);
  els.prevBtn.addEventListener('click', () => { if (state.page > 1) { state.page -= 1; loadArticles(); } });
  els.nextBtn.addEventListener('click', () => { state.page += 1; loadArticles(); });

  async function initStatic() {
    showSkeletons();
    try {
      const res = await fetch(STATIC_URL, { cache: 'no-cache', signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bundle = await res.json();
      state.staticArticles = Array.isArray(bundle.articles) ? bundle.articles : [];
      state.metaTags = Array.isArray(bundle.meta?.tags) ? bundle.meta.tags : [];
      state.generatedAt = bundle.generated_at || '';
      if (bundle.digest) {
        els.digestDate.textContent = bundle.digest.digest_date || '';
        els.digestTitle.textContent = bundle.digest.title || 'AI 今日焦点';
        els.digestBody.innerHTML = renderSimpleMd(bundle.digest.overview_md || '');
        els.digestBox.hidden = false;
      }
      renderModelTabs();
      renderHotTags();
      queryStaticArticles();
    } catch {
      els.summary.textContent = '资讯数据加载失败';
      els.list.innerHTML = `<div class="ainews-state-box">
        <p>暂时无法加载静态资讯清单（<code>${esc(STATIC_URL)}</code>）。</p>
        <button type="button" class="ainews-state-btn" data-retry>重新加载</button>
      </div>`;
      els.list.querySelector('[data-retry]')?.addEventListener('click', initStatic);
    }
  }

  async function initApi() {
    renderModelTabs();
    showSkeletons();
    const [digestRes, metaRes, articlesRes] = await Promise.allSettled([
      fetch(`${API_BASE}/digests/latest`, { signal: AbortSignal.timeout(12000) }).then(r => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/meta/filters`, { signal: AbortSignal.timeout(12000) }).then(r => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/articles?page=1&page_size=${state.pageSize}`, { signal: AbortSignal.timeout(15000) }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
    ]);

    if (digestRes.status === 'fulfilled' && digestRes.value) {
      const d = digestRes.value;
      els.digestDate.textContent = d.digest_date || '';
      els.digestTitle.textContent = d.title || 'AI 今日焦点';
      els.digestBody.innerHTML = renderSimpleMd(d.overview_md || '');
      els.digestBox.hidden = false;
    }

    if (metaRes.status === 'fulfilled' && Array.isArray(metaRes.value?.tags)) {
      state.metaTags = metaRes.value.tags;
      renderModelTabs();
      renderHotTags();
    }

    if (articlesRes.status === 'fulfilled') {
      renderArticles(articlesRes.value);
    } else {
      els.summary.textContent = '资讯服务暂时无法连接';
      els.list.innerHTML = `<div class="ainews-state-box">
        <p>未能连接到 AI 资讯后端（<code>${esc(API_BASE)}</code>）。</p>
        <button type="button" class="ainews-state-btn" data-retry>重新加载</button>
      </div>`;
      els.list.querySelector('[data-retry]')?.addEventListener('click', initApi);
    }
  }

  if (USE_STATIC) {
    initStatic();
  } else {
    initApi();
  }
}
