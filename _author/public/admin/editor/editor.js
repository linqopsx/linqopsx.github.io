const state = {
  collection: 'posts',
  files: [],
  currentPath: null,
  currentSha: null,
  tokenReady: false,
  uploadTarget: 'inline'
};

const $ = sel => document.querySelector(sel);
const els = {
  list: $('[data-file-list]'),
  filter: $('[data-filter]'),
  banner: $('[data-token-banner]'),
  heading: $('[data-editor-heading]'),
  path: $('[data-file-path]'),
  status: $('[data-status]'),
  form: $('[data-editor-form]'),
  metaGrid: $('[data-meta-grid]'),
  toggles: $('[data-toggles]'),
  panes: $('[data-panes]'),
  preview: $('[data-preview]'),
  delBtn: $('[data-delete]'),
  saveBtn: $('[data-save]'),
  saveTopBtn: $('[data-save-top]'),
  picker: $('[data-file-picker]'),
  title: $('#f-title'),
  date: $('#f-date'),
  categories: $('#f-categories'),
  tags: $('#f-tags'),
  image: $('#f-image'),
  description: $('#f-description'),
  comments: $('#f-comments'),
  pin: $('#f-pin'),
  math: $('#f-math'),
  mermaid: $('#f-mermaid'),
  published: $('#f-published'),
  body: $('#f-body')
};

function setStatus(text, kind = '') {
  els.status.textContent = text;
  els.status.className = `ed-status${kind ? ' is-' + kind : ''}`;
}

function beijingNow() {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(new Date()).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  return {
    full: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} +0800`,
    prefix: `${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}${parts.second}`
  };
}

function slugFromTitle(title) {
  const ascii = String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return ascii;
}

function yamlQuote(val) {
  const s = String(val ?? '');
  if (!s) return '""';
  if (/[:#\[\]{}&*!|>'"%@`\n]/.test(s) || /^\s|\s$/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}

function parseFrontMatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw || '');
  if (!match) return { meta: {}, body: raw || '' };
  const lines = match[1].split(/\r?\n/);
  const meta = {};
  let listKey = null;
  for (const line of lines) {
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && listKey) {
      meta[listKey].push(item[1].trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    listKey = null;
    const kv = /^([a-zA-Z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, key, rest] = kv;
    if (rest === '') {
      meta[key] = [];
      listKey = key;
    } else if (rest.startsWith('[') && rest.endsWith(']')) {
      meta[key] = rest.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else if (rest === 'true' || rest === 'false') {
      meta[key] = rest === 'true';
    } else {
      meta[key] = rest.trim().replace(/^["']|["']$/g, '');
    }
  }
  return { meta, body: match[2] };
}

function buildMarkdown() {
  if (state.collection === 'about') {
    return `---\nicon: fas fa-info-circle\norder: 4\n---\n\n${els.body.value.trim()}\n`;
  }
  const lines = ['---'];
  lines.push(`title: ${yamlQuote(els.title.value.trim())}`);
  lines.push(`date: ${els.date.value.trim() || beijingNow().full}`);
  if (els.description.value.trim()) {
    lines.push(`description: ${yamlQuote(els.description.value.trim())}`);
  }
  if (state.collection === 'posts') {
    const cats = els.categories.value.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 2);
    const tags = els.tags.value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    if (cats.length) {
      lines.push('categories:');
      cats.forEach(c => lines.push(`  - ${yamlQuote(c)}`));
    }
    if (tags.length) {
      lines.push('tags:');
      tags.forEach(t => lines.push(`  - ${yamlQuote(t)}`));
    }
    if (els.image.value.trim()) {
      lines.push(`image: ${yamlQuote(els.image.value.trim())}`);
    }
    lines.push(`comments: ${els.comments.checked}`);
    lines.push(`pin: ${els.pin.checked}`);
    lines.push(`math: ${els.math.checked}`);
    lines.push(`mermaid: ${els.mermaid.checked}`);
  } else if (state.collection === 'updates') {
    lines.push(`published: ${els.published.checked}`);
  }
  lines.push('---', '', els.body.value.replace(/\r\n/g, '\n').trimEnd(), '');
  return lines.join('\n');
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function renderMarkdown(md) {
  let html = escapeHtml(md || '');
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => `<pre><code>${code}</code></pre>`);
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  html = html.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
  return `<p>${html}</p>`;
}

function updatePreview() {
  els.preview.innerHTML = renderMarkdown(els.body.value);
}

function syncCollectionUi() {
  const isPost = state.collection === 'posts';
  const isUpdate = state.collection === 'updates';
  const isAbout = state.collection === 'about';
  document.querySelectorAll('[data-col]').forEach(b => b.classList.toggle('is-active', b.dataset.col === state.collection));
  els.metaGrid.hidden = isAbout;
  els.toggles.hidden = isAbout;
  document.querySelectorAll('[data-post-only]').forEach(el => { el.hidden = !isPost; });
  document.querySelectorAll('[data-update-only]').forEach(el => { el.hidden = !isUpdate; });
  els.title.required = !isAbout;
  els.date.required = !isAbout;
}

function resetNewEntry() {
  state.currentPath = null;
  state.currentSha = null;
  const now = beijingNow();
  els.title.value = '';
  els.date.value = now.full;
  els.categories.value = '';
  els.tags.value = '';
  els.image.value = '';
  els.description.value = '';
  els.comments.checked = true;
  els.pin.checked = false;
  els.math.checked = false;
  els.mermaid.checked = false;
  els.published.checked = false;
  els.body.value = '';
  els.heading.textContent = state.collection === 'updates' ? '新建更新公告' : '新建公开文章';
  els.path.textContent = `${state.collection === 'updates' ? '_updates' : '_posts'}/${now.prefix}-.md`;
  els.delBtn.hidden = true;
  renderFileList();
  updatePreview();
  setStatus('新建模式');
}

function renderFileList() {
  const kw = els.filter.value.trim().toLowerCase();
  const visible = state.files.filter(f => f.name.toLowerCase().includes(kw));
  els.list.replaceChildren();
  if (!visible.length) {
    const p = document.createElement('p');
    p.className = 'writing-note';
    p.style.margin = '8px 6px';
    p.textContent = state.tokenReady ? '没有匹配的文件' : '配置令牌后自动加载列表';
    els.list.append(p);
    return;
  }
  for (const file of visible) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ed-file-item${state.currentPath === file.path ? ' is-active' : ''}`;
    btn.innerHTML = `<span class="ed-file-name">${escapeHtml(file.name.replace(/\.md$/, ''))}</span><span class="ed-file-sub">${escapeHtml(file.path)}</span>`;
    btn.addEventListener('click', () => openFile(file.path));
    els.list.append(btn);
  }
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

async function loadList() {
  syncCollectionUi();
  if (state.collection === 'about') {
    state.files = [{ name: 'about.md', path: '_tabs/about.md' }];
    renderFileList();
    if (state.tokenReady) await openFile('_tabs/about.md');
    return;
  }
  if (!state.tokenReady) {
    state.files = [];
    renderFileList();
    return;
  }
  setStatus('正在加载文件列表…');
  try {
    const data = await api(`/api/list?collection=${state.collection}`);
    state.files = data.files || [];
    renderFileList();
    setStatus(`已加载 ${state.files.length} 个文件`);
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function openFile(filePath) {
  setStatus(`正在读取 ${filePath}…`);
  try {
    const data = await api(`/api/file?path=${encodeURIComponent(filePath)}`);
    const { meta, body } = parseFrontMatter(data.content);
    state.currentPath = data.path;
    state.currentSha = data.sha;
    els.title.value = meta.title || '';
    els.date.value = meta.date || beijingNow().full;
    els.categories.value = Array.isArray(meta.categories) ? meta.categories.join(', ') : (meta.categories || '');
    els.tags.value = Array.isArray(meta.tags) ? meta.tags.join(', ') : (meta.tags || '');
    els.image.value = typeof meta.image === 'string' ? meta.image : '';
    els.description.value = meta.description || '';
    els.comments.checked = meta.comments !== false;
    els.pin.checked = meta.pin === true;
    els.math.checked = meta.math === true;
    els.mermaid.checked = meta.mermaid === true;
    els.published.checked = meta.published === true;
    els.body.value = body.replace(/^\n+/, '');
    els.heading.textContent = state.collection === 'about' ? '编辑关于我' : (meta.title || data.name);
    els.path.textContent = data.path;
    els.delBtn.hidden = state.collection === 'about';
    renderFileList();
    updatePreview();
    setStatus('已加载，可开始编辑');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function saveCurrent(event) {
  if (event) event.preventDefault();
  if (!state.tokenReady) {
    setStatus('尚未配置 GITHUB_CONTENT_TOKEN，暂时无法写入仓库', 'error');
    return;
  }
  let targetPath = state.currentPath;
  if (!targetPath) {
    const now = beijingNow();
    const dir = state.collection === 'updates' ? '_updates' : '_posts';
    targetPath = `${dir}/${now.prefix}-${slugFromTitle(els.title.value)}.md`;
  }
  const content = buildMarkdown();
  els.saveBtn.disabled = true;
  els.saveTopBtn.disabled = true;
  setStatus('正在提交到 GitHub main…');
  try {
    const res = await api('/api/file', {
      method: 'PUT',
      body: JSON.stringify({
        path: targetPath,
        sha: state.currentSha || undefined,
        content,
        message: `${state.currentSha ? 'Update' : 'Create'} ${targetPath}`
      })
    });
    state.currentPath = res.path;
    state.currentSha = res.sha;
    els.path.textContent = res.path;
    els.delBtn.hidden = state.collection === 'about';
    setStatus('保存成功！已推送到 main，GitHub Actions 正在自动构建发布。', 'ok');
    if (state.collection !== 'about') await loadList();
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    els.saveBtn.disabled = false;
    els.saveTopBtn.disabled = false;
  }
}

async function deleteCurrent() {
  if (!state.currentPath || !state.currentSha) return;
  if (!confirm(`确定要从仓库删除 ${state.currentPath} 吗？删除后博客将在下次构建移除该文章。`)) return;
  setStatus('正在删除…');
  try {
    await api('/api/file', {
      method: 'DELETE',
      body: JSON.stringify({ path: state.currentPath, sha: state.currentSha, message: `Delete ${state.currentPath}` })
    });
    setStatus('已删除', 'ok');
    resetNewEntry();
    await loadList();
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

async function uploadImageFile(file, target) {
  if (!state.tokenReady) {
    setStatus('尚未配置 GITHUB_CONTENT_TOKEN，暂时无法上传图片', 'error');
    return;
  }
  setStatus(`正在上传图片 ${file.name}…`);
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('读取图片失败'));
      reader.readAsDataURL(file);
    });
    const res = await api('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, base64 })
    });
    if (target === 'cover') {
      els.image.value = res.url;
    } else {
      insertAtCursor(`![${file.name.replace(/\.[^.]+$/, '')}](${res.url})\n`);
    }
    setStatus(`图片已上传：${res.url}`, 'ok');
  } catch (err) {
    setStatus(err.message, 'error');
  }
}

function insertAtCursor(snippet) {
  const ta = els.body;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  ta.value = ta.value.slice(0, start) + snippet + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + snippet.length;
  ta.focus();
  updatePreview();
}

function wrapSelection(marker) {
  const ta = els.body;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selected = ta.value.slice(start, end) || '文字';
  const replaced = `${marker}${selected}${marker}`;
  ta.value = ta.value.slice(0, start) + replaced + ta.value.slice(end);
  ta.selectionStart = start + marker.length;
  ta.selectionEnd = start + marker.length + selected.length;
  ta.focus();
  updatePreview();
}

// Event bindings
document.querySelectorAll('[data-col]').forEach(btn => {
  btn.addEventListener('click', () => {
    state.collection = btn.dataset.col;
    if (state.collection !== 'about') resetNewEntry();
    loadList();
  });
});

document.querySelectorAll('[data-mode-btn]').forEach(btn => {
  btn.addEventListener('click', () => {
    els.panes.dataset.mode = btn.dataset.modeBtn;
    document.querySelectorAll('[data-mode-btn]').forEach(b => b.classList.toggle('is-active', b === btn));
  });
});

document.querySelectorAll('[data-insert]').forEach(btn => {
  btn.addEventListener('click', () => insertAtCursor(btn.dataset.insert));
});

document.querySelectorAll('[data-wrap]').forEach(btn => {
  btn.addEventListener('click', () => wrapSelection(btn.dataset.wrap));
});

$('[data-new-entry]').addEventListener('click', () => {
  if (state.collection === 'about') state.collection = 'posts';
  syncCollectionUi();
  resetNewEntry();
});

$('[data-save-top]').addEventListener('click', () => els.form.requestSubmit());
$('[data-reload-list]').addEventListener('click', loadList);
els.form.addEventListener('submit', saveCurrent);
els.delBtn.addEventListener('click', deleteCurrent);
els.filter.addEventListener('input', renderFileList);
els.body.addEventListener('input', updatePreview);

$('[data-upload-inline]').addEventListener('click', () => { state.uploadTarget = 'inline'; els.picker.click(); });
$('[data-upload-cover]').addEventListener('click', () => { state.uploadTarget = 'cover'; els.picker.click(); });
els.picker.addEventListener('change', () => {
  const file = els.picker.files?.[0];
  if (file) uploadImageFile(file, state.uploadTarget);
  els.picker.value = '';
});

els.body.addEventListener('paste', event => {
  const item = [...(event.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
  if (item) {
    event.preventDefault();
    const file = item.getAsFile();
    if (file) uploadImageFile(file, 'inline');
  }
});

// Init
(async () => {
  const params = new URLSearchParams(location.search);
  if (params.get('collection') === 'updates') state.collection = 'updates';
  if (params.get('collection') === 'about') state.collection = 'about';
  syncCollectionUi();
  resetNewEntry();
  try {
    const info = await api('/api/status');
    state.tokenReady = Boolean(info.contentTokenConfigured);
    els.banner.hidden = state.tokenReady;
    await loadList();
  } catch (err) {
    setStatus(err.message, 'error');
  }
})();
