const SESSION = '__Host-blog_author';
const OAUTH = '__Host-blog_oauth';
const SESSION_SECONDS = 8 * 60 * 60;
const OAUTH_SECONDS = 10 * 60;
const encoder = new TextEncoder();

function encode(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decode(value) {
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
}

async function key(secret, usage) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

async function sign(payload, secret) {
  const body = encode(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await key(secret, 'sign'), encoder.encode(body));
  return `${body}.${encode(new Uint8Array(signature))}`;
}

async function verify(value, secret, kind, now) {
  // Cookies cross the trust boundary here. Malformed or expired values grant no access.
  try {
    if (!value || value.length > 4096 || !/^[\w-]+\.[\w-]+$/.test(value)) return null;
    const [body, signature] = value.split('.');
    if (!await crypto.subtle.verify('HMAC', await key(secret, 'verify'), decode(signature), encoder.encode(body))) return null;
    const payload = JSON.parse(new TextDecoder().decode(decode(body)));
    return payload.kind === kind && Number.isSafeInteger(payload.exp) && payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}

function cookies(request) {
  return new Map((request.headers.get('Cookie') || '').split(';').map(part => {
    const separator = part.indexOf('=');
    return [part.slice(0, separator).trim(), part.slice(separator + 1)];
  }));
}

function cookie(name, value, seconds) {
  return `${name}=${value}; Max-Age=${seconds}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function secure(response) {
  const result = new Response(response.body, response);
  result.headers.set('Cache-Control', 'private, no-store');
  result.headers.set('Vary', 'Cookie');
  result.headers.set('Referrer-Policy', 'no-referrer');
  result.headers.set('X-Content-Type-Options', 'nosniff');
  result.headers.set('X-Frame-Options', 'DENY');
  result.headers.set('X-Robots-Tag', 'noindex, nofollow');
  result.headers.set('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  return result;
}

function redirect(location, status = 303) {
  return new Response(null, { status, headers: { Location: location } });
}

function nextPath(raw, origin) {
  if (!raw || raw.length > 1024) return '/admin/';
  try {
    const url = new URL(raw, origin);
    return url.origin === origin && (url.pathname === '/admin' || url.pathname.startsWith('/admin/'))
      ? url.pathname + url.search : '/admin/';
  } catch {
    return '/admin/';
  }
}

function loginPage(env, { status = 200, title = '作者登录', message = '使用你的 GitHub 账号进入写作后台。', next = '/admin/' } = {}) {
  // All display strings are fixed server text. Only the validated local destination is encoded into the link.
  return new Response(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title} · Theodore 的博客</title><style>
  :root{color-scheme:light;--surface:rgba(255,255,255,.88);--ink:#1c1c1e;--muted:rgba(60,60,67,.74);--sep:rgba(60,60,67,.14);--blue:#007aff;--blue-h:#0066d6;--glass:rgba(255,255,255,.78);--g-border:rgba(255,255,255,.85);--scrim:linear-gradient(180deg,rgba(242,242,247,.32),rgba(242,242,247,.58));--card-border:rgba(255,255,255,.82)}*{box-sizing:border-box}body{margin:0;min-height:100svh;position:relative;color:var(--ink);font:16px/1.75 -apple-system,BlinkMacSystemFont,"SF Pro Display","PingFang SC","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased;background:#f2f2f7 url('/assets/img/morning/hero-fish.webp') center 28%/cover no-repeat fixed}body::before{content:"";position:fixed;inset:0;z-index:-1;background:var(--scrim);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}header{position:sticky;top:14px;width:min(960px,calc(100% - 32px));margin:14px auto 0;padding:12px 22px;border-radius:999px;border:1px solid var(--g-border);background:var(--glass);backdrop-filter:saturate(200%) blur(24px);-webkit-backdrop-filter:saturate(200%) blur(24px);box-shadow:inset 0 1px .5px rgba(255,255,255,.92),0 10px 30px -10px rgba(0,0,0,.14)}header a{color:var(--ink);font-size:17px;font-weight:700;letter-spacing:-.02em;text-decoration:none}header a span{color:var(--blue)}main{width:min(460px,calc(100% - 32px));margin:10vh auto;padding:34px 32px;background:var(--surface);border:1px solid var(--card-border);backdrop-filter:saturate(180%) blur(24px);-webkit-backdrop-filter:saturate(180%) blur(24px);border-radius:28px;box-shadow:0 20px 48px -18px rgba(0,0,0,.18);text-align:center}.avatar{width:68px;height:68px;margin:0 auto 14px;border-radius:50%;overflow:hidden;border:2.5px solid #fff;box-shadow:0 8px 20px rgba(0,0,0,.14)}.avatar img{display:block;width:100%;height:100%;object-fit:cover}.eyebrow{color:var(--blue);letter-spacing:.1em;font-size:12px;font-weight:650;text-transform:uppercase}h1{font-size:28px;font-weight:750;line-height:1.25;letter-spacing:-.025em;margin:6px 0 10px}p{color:var(--muted);margin:0 0 12px}.button{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:46px;margin:22px 0 16px;background:var(--blue);color:#fff;border-radius:999px;font-weight:600;text-decoration:none}.button:hover{background:var(--blue-h)}.back{color:var(--blue);font-size:14px;font-weight:500;text-decoration:none}.back:hover{text-decoration:underline}.note{font-size:13px;margin-top:22px;padding-top:18px;border-top:1px solid var(--sep)}svg{width:20px;height:20px;fill:currentColor}@media(max-width:600px){main{margin:7vh auto;padding:26px 22px;border-radius:24px}h1{font-size:25px}}
  </style></head><body><header><a href="${env.BLOG_URL}">Theodore<span>.</span></a></header><main><div class="avatar"><img src="/assets/img/avatar.png" width="68" height="68" alt="Theodore"></div><span class="eyebrow">THEODORE · 写作后台</span><h1>${title}</h1><p>${message}</p><a class="button" href="/auth/login?next=${encodeURIComponent(next)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.3c-3.3.7-4-1.4-4-1.4-.5-1.3-1.3-1.6-1.3-1.6-1.1-.8.1-.8.1-.8 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6a4.7 4.7 0 0 1 1.2-3.2c-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1a4.7 4.7 0 0 1 1.2 3.2c0 4.7-2.8 5.7-5.5 6 .5.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6A12 12 0 0 0 12 .5z"/></svg>使用 GitHub 登录</a><a class="back" href="${env.BLOG_URL}">← 返回博客阅读</a><p class="note">此处仅供博客作者使用。登录其他 GitHub 账号无法进入管理页。</p></main></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

const REPO = 'linqopsx/linqopsx.github.io';
const BRANCH = 'main';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function isAllowedContentPath(path, allowDelete = false) {
  if (typeof path !== 'string' || !path || path.length > 240 || path.includes('..') || path.includes('\\')) return false;
  if (/^_(posts|updates)\/[^/]+\.md$/.test(path)) return true;
  if (!allowDelete && path === '_tabs/about.md') return true;
  return false;
}

function encodeGitHubPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function toBase64Utf8(text) {
  const bytes = encoder.encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64Utf8(base64) {
  const binary = atob((base64 || '').replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function sanitizeImageName(raw) {
  const base = String(raw || 'image.png').split(/[\\/]/).pop().toLowerCase();
  const match = /^([a-z0-9._-]{1,80})\.(png|jpe?g|webp|gif|svg)$/i.exec(base.replace(/[^a-z0-9._-]+/g, '-'));
  const ext = match ? match[2].toLowerCase() : 'png';
  const stem = (match ? match[1] : 'image').replace(/^-+|-+$/g, '').slice(0, 40) || 'image';
  return `${stem}.${ext}`;
}

export function createApp({ fetchImpl = fetch, now = () => Math.floor(Date.now() / 1000) } = {}) {
  return {
    async fetch(request, env) {
      try {
        return secure(await route(request, env));
      } catch {
        // Do not log OAuth codes, cookies, client secrets, or upstream response bodies.
        return secure(loginPage(env, { status: 502, title: '登录暂时未完成', message: '连接 GitHub 时遇到问题，请重新登录。' }));
      }
    }
  };

  async function route(request, env) {
    const url = new URL(request.url);
    const origin = new URL(env.PUBLIC_URL).origin;
    const configured = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.SESSION_SECRET);

    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({ ok: true, configured, editorConfigured: Boolean(env.GITHUB_CONTENT_TOKEN) });
    }
    if (url.pathname === '/auth/logout' && request.method === 'POST') {
      if (request.headers.get('Origin') !== origin) return new Response('Forbidden', { status: 403 });
      const response = redirect('/');
      response.headers.append('Set-Cookie', cookie(SESSION, '', 0));
      response.headers.append('Set-Cookie', cookie(OAUTH, '', 0));
      return response;
    }

    // Authenticated Author Content API (strictly scoped to blog repository allowlist)
    if (url.pathname.startsWith('/api/')) {
      if (!configured) return Response.json({ error: '服务未完成配置' }, { status: 503 });
      const jar = cookies(request);
      const session = await verify(jar.get(SESSION), env.SESSION_SECRET, 'session', now());
      if (session?.sub !== env.AUTHOR_ID) return Response.json({ error: '需要作者登录' }, { status: 401 });
      if (request.method !== 'GET' && request.headers.get('Origin') !== origin) {
        return Response.json({ error: '非法来源请求' }, { status: 403 });
      }
      if (url.pathname === '/api/status' && request.method === 'GET') {
        return Response.json({ ok: true, contentTokenConfigured: Boolean(env.GITHUB_CONTENT_TOKEN), repo: REPO, branch: BRANCH });
      }
      if (!env.GITHUB_CONTENT_TOKEN) {
        return Response.json({ error: '尚未配置 GITHUB_CONTENT_TOKEN，请先在 Cloudflare Secrets 中添加单仓库写入令牌。' }, { status: 503 });
      }
      const ghHeaders = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GITHUB_CONTENT_TOKEN}`,
        'User-Agent': 'Theodore-Blog-Author',
        'X-GitHub-Api-Version': '2022-11-28'
      };
      const gh = (apiPath, init = {}) => fetchImpl(`https://api.github.com/repos/${REPO}/${apiPath}`, {
        ...init,
        headers: { ...ghHeaders, ...(init.headers || {}) },
        signal: AbortSignal.timeout(20000)
      });

      if (url.pathname === '/api/list' && request.method === 'GET') {
        const col = url.searchParams.get('collection');
        const dir = col === 'updates' ? '_updates' : col === 'posts' ? '_posts' : null;
        if (!dir) return Response.json({ error: '无效集合' }, { status: 400 });
        const res = await gh(`contents/${dir}?ref=${BRANCH}`);
        if (!res.ok) return Response.json({ error: `读取列表失败 (${res.status})` }, { status: res.status });
        const items = await res.json();
        const files = (Array.isArray(items) ? items : [])
          .filter(item => item.type === 'file' && item.name.endsWith('.md'))
          .map(item => ({ name: item.name, path: item.path, sha: item.sha, size: item.size }))
          .sort((a, b) => b.name.localeCompare(a.name));
        return Response.json({ files });
      }

      if (url.pathname === '/api/file' && request.method === 'GET') {
        const filePath = url.searchParams.get('path');
        if (!isAllowedContentPath(filePath)) return Response.json({ error: '路径不在允许范围内' }, { status: 400 });
        const res = await gh(`contents/${encodeGitHubPath(filePath)}?ref=${BRANCH}`);
        if (!res.ok) return Response.json({ error: `读取文件失败 (${res.status})` }, { status: res.status });
        const data = await res.json();
        return Response.json({ path: data.path, name: data.name, sha: data.sha, content: fromBase64Utf8(data.content) });
      }

      if (url.pathname === '/api/file' && request.method === 'PUT') {
        const body = await request.json();
        if (!isAllowedContentPath(body?.path) || typeof body?.content !== 'string') {
          return Response.json({ error: '无效的文件路径或内容' }, { status: 400 });
        }
        const payload = {
          message: String(body.message || `Update ${body.path}`).slice(0, 120),
          content: toBase64Utf8(body.content),
          branch: BRANCH
        };
        if (typeof body.sha === 'string' && body.sha) payload.sha = body.sha;
        const res = await gh(`contents/${encodeGitHubPath(body.path)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return Response.json({ error: data.message || `保存失败 (${res.status})` }, { status: res.status });
        return Response.json({ ok: true, path: data.content?.path || body.path, sha: data.content?.sha, commit: data.commit?.sha });
      }

      if (url.pathname === '/api/file' && request.method === 'DELETE') {
        const body = await request.json();
        if (!isAllowedContentPath(body?.path, true) || typeof body?.sha !== 'string' || !body.sha) {
          return Response.json({ error: '无效的删除请求' }, { status: 400 });
        }
        const res = await gh(`contents/${encodeGitHubPath(body.path)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: String(body.message || `Delete ${body.path}`).slice(0, 120),
            sha: body.sha,
            branch: BRANCH
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return Response.json({ error: data.message || `删除失败 (${res.status})` }, { status: res.status });
        return Response.json({ ok: true });
      }

      if (url.pathname === '/api/upload' && request.method === 'POST') {
        const body = await request.json();
        const b64 = typeof body?.base64 === 'string' ? body.base64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '') : '';
        if (!b64 || b64.length > Math.ceil(MAX_UPLOAD_BYTES * 4 / 3) + 64) {
          return Response.json({ error: '图片无效或超过 5MB 限制' }, { status: 400 });
        }
        const safeName = sanitizeImageName(body?.filename);
        const stamped = `${now()}-${safeName}`;
        const targetPath = `assets/img/uploads/${stamped}`;
        const res = await gh(`contents/${encodeGitHubPath(targetPath)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `Upload image ${stamped}`, content: b64, branch: BRANCH })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return Response.json({ error: data.message || `图片上传失败 (${res.status})` }, { status: res.status });
        return Response.json({ ok: true, path: targetPath, url: `/${targetPath}` });
      }

      return Response.json({ error: '接口不存在' }, { status: 404 });
    }

    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });

    // These files are public blog styling only. Never forward the author's cookies to the blog.
    if (url.pathname.startsWith('/assets/')) {
      const upstream = await fetchImpl(new URL(url.pathname + url.search, env.BLOG_URL), { method: request.method, redirect: 'manual' });
      const headers = new Headers({ 'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream' });
      return new Response(upstream.body, { status: upstream.status, headers });
    }
    if (url.pathname === '/sw.min.js') {
      return new Response("self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));", { headers: { 'Content-Type': 'text/javascript' } });
    }
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n');

    if (!configured) return loginPage(env, { status: 503, title: '作者登录准备中', message: '后台正在完成登录配置，请稍后再试。' });
    const jar = cookies(request);
    const timestamp = now();
    const session = await verify(jar.get(SESSION), env.SESSION_SECRET, 'session', timestamp);
    const author = session?.sub === env.AUTHOR_ID;

    if (url.pathname === '/auth/login') {
      const next = nextPath(url.searchParams.get('next'), origin);
      if (author) return redirect(next);
      const state = encode(crypto.getRandomValues(new Uint8Array(32)));
      const verifier = encode(crypto.getRandomValues(new Uint8Array(32)));
      const challenge = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
      const pending = await sign({ kind: 'oauth', state, verifier, next, exp: timestamp + OAUTH_SECONDS }, env.SESSION_SECRET);
      const destination = new URL('https://github.com/login/oauth/authorize');
      destination.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: origin + '/auth/callback', scope: '', state, code_challenge: challenge, code_challenge_method: 'S256', allow_signup: 'false' });
      const response = redirect(destination.href);
      response.headers.append('Set-Cookie', cookie(OAUTH, pending, OAUTH_SECONDS));
      return response;
    }

    if (url.pathname === '/auth/callback') {
      const pending = await verify(jar.get(OAUTH), env.SESSION_SECRET, 'oauth', timestamp);
      let response;
      const code = url.searchParams.get('code');
      if (!pending || pending.state !== url.searchParams.get('state') || !code || code.length > 512 || url.searchParams.has('error')) {
        response = loginPage(env, { status: 400, title: '请重新登录', message: '本次登录已取消或过期，请重新点击 GitHub 登录。' });
      } else {
        const exchange = await fetchImpl('https://github.com/login/oauth/access_token', {
          method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: origin + '/auth/callback', code_verifier: pending.verifier }),
          signal: AbortSignal.timeout(15000)
        });
        const token = await exchange.json();
        if (!exchange.ok || typeof token.access_token !== 'string') throw new Error('OAuth exchange failed');
        const identity = await fetchImpl('https://api.github.com/user', {
          headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.access_token}`, 'User-Agent': 'Theodore-Blog-Author', 'X-GitHub-Api-Version': '2022-11-28' },
          signal: AbortSignal.timeout(15000)
        });
        const user = await identity.json();
        if (!identity.ok || !Number.isSafeInteger(user.id)) throw new Error('GitHub identity unavailable');
        if (String(user.id) !== env.AUTHOR_ID) {
          response = loginPage(env, { status: 403, title: '仅限博客作者', message: '当前 GitHub 账号没有写作后台权限，请切换到作者账号后重试。' });
          response.headers.append('Set-Cookie', cookie(SESSION, '', 0));
        } else {
          const value = await sign({ kind: 'session', sub: env.AUTHOR_ID, exp: timestamp + SESSION_SECONDS }, env.SESSION_SECRET);
          response = redirect(nextPath(pending.next, origin));
          response.headers.append('Set-Cookie', cookie(SESSION, value, SESSION_SECONDS));
        }
      }
      response.headers.append('Set-Cookie', cookie(OAUTH, '', 0));
      return response;
    }

    if (url.pathname === '/' || url.pathname === '/login') {
      return author ? redirect('/admin/') : loginPage(env);
    }
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      if (!author) return loginPage(env, { status: 401, next: nextPath(url.pathname + url.search, origin) });
      return env.ASSETS.fetch(request);
    }
    return new Response('Not found', { status: 404 });
  }
}

export default createApp();
