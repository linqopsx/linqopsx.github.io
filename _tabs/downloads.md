---
layout: page
title: 软件下载
icon: fas fa-download
order: 5
permalink: /downloads/
---

这里收录博客中分享的安装包和资料，点击文件旁的按钮即可下载。

<link rel="stylesheet" href="/assets/css/downloads.css">
<section id="software-downloads" aria-label="软件下载列表">
  <div class="download-toolbar">
    <input type="search" data-search aria-label="搜索文件" placeholder="搜索软件或文件名…">
    <button type="button" data-refresh>刷新列表</button>
  </div>
  <p data-count></p>
  <p data-status role="status" aria-live="polite">正在读取下载列表…</p>
  <div data-file-list></div>
  <p>文件由 GitHub 托管。若列表加载失败，可<a href="https://github.com/linqopsx/linqopsx.github.io/releases/tag/blog-downloads" target="_blank" rel="noopener noreferrer">直接打开 GitHub 下载页 ↗</a>。</p>
</section>
<noscript>请启用 JavaScript，或通过上方的 GitHub 下载页获取文件。</noscript>
<script type="module" src="/assets/js/downloads.mjs"></script>
