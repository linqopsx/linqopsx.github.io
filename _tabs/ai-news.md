---
layout: page
title: AI 前沿资讯
icon: fas fa-bolt
order: 4
permalink: /ai-news/
toc: false
---

<link rel="stylesheet" href="{{ '/assets/css/ai-news.css' | relative_url }}?v=20261127">

<section id="ai-news-app" data-api-base="{{ site.data.ai_news.api_base | default: '/ai-news-api' | escape }}" aria-label="AI 前沿资讯">
  <header class="ainews-head">
    <p class="ainews-subtitle">聚合 OpenAI、Gemini、Claude、DeepSeek、通义千问等主流大模型的最新动态，支持按大模型分页浏览。</p>
    <div class="ainews-head-actions">
      <a class="ainews-rss-btn" data-rss-link href="#" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>
        </svg>
        <span>RSS 订阅</span>
      </a>
    </div>
  </header>

  <section class="ainews-digest" data-digest-box hidden aria-label="今日焦点日报">
    <div class="ainews-digest-head">
      <span class="ainews-digest-badge">今日焦点</span>
      <time data-digest-date></time>
    </div>
    <h2 data-digest-title data-toc-skip></h2>
    <div class="ainews-digest-body" data-digest-body></div>
  </section>

  <nav class="ainews-model-tabs" data-model-tabs role="tablist" aria-label="按大模型分页切换"></nav>

  <div class="ainews-filters" aria-label="筛选与搜索">
    <div class="ainews-filter-row">
      <div class="ainews-seg" data-filter-region role="tablist" aria-label="地区筛选">
        <button type="button" class="is-active" data-val="">全部地区</button>
        <button type="button" data-val="cn">国内</button>
        <button type="button" data-val="global">海外</button>
      </div>
      <div class="ainews-seg" data-filter-priority role="tablist" aria-label="重要程度">
        <button type="button" class="is-active" data-val="">全部分级</button>
        <button type="button" data-val="P0">重磅 P0</button>
        <button type="button" data-val="P1">值得看 P1</button>
      </div>
      <div class="ainews-search-wrap">
        <input class="ainews-search" type="search" data-search placeholder="搜索标题或一句话结论…" aria-label="搜索 AI 资讯">
      </div>
    </div>
    <div class="ainews-tags-bar" data-hot-tags hidden aria-label="热门标签"></div>
  </div>

  <div class="ainews-meta-bar">
    <span data-result-summary>正在加载资讯…</span>
    <button type="button" class="ainews-clear-btn" data-clear-filters hidden>清空筛选</button>
  </div>

  <div class="ainews-list" data-article-list></div>

  <nav class="ainews-pager" data-pager hidden aria-label="资讯分页">
    <button type="button" data-prev-page>← 上一页</button>
    <span class="ainews-page-info" data-page-info></span>
    <button type="button" data-next-page>下一页 →</button>
  </nav>
</section>

<noscript>请启用 JavaScript 以加载 AI 前沿资讯列表。</noscript>
<script type="module" src="{{ '/assets/js/ai-news.mjs' | relative_url }}?v=20261127"></script>
