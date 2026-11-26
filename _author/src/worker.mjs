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
  :root{color-scheme:light dark;--surface:rgba(255,255,255,.86);--ink:#1c1c1e;--muted:rgba(60,60,67,.74);--sep:rgba(60,60,67,.14);--blue:#007aff;--blue-h:#0066d6;--glass:rgba(255,255,255,.72);--g-border:rgba(255,255,255,.78);--scrim:linear-gradient(180deg,rgba(12,20,36,.38),rgba(12,20,36,.58));--card-border:rgba(255,255,255,.75)}*{box-sizing:border-box}body{margin:0;min-height:100svh;position:relative;color:var(--ink);font:16px/1.75 -apple-system,BlinkMacSystemFont,"SF Pro Display","PingFang SC","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased;background:#0b1120 url('/assets/img/morning/hero-fish.webp') center 28%/cover no-repeat fixed}body::before{content:"";position:fixed;inset:0;z-index:-1;background:var(--scrim);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}header{position:sticky;top:14px;width:min(960px,calc(100% - 32px));margin:14px auto 0;padding:12px 22px;border-radius:999px;border:1px solid var(--g-border);background:var(--glass);backdrop-filter:saturate(200%) blur(24px);-webkit-backdrop-filter:saturate(200%) blur(24px);box-shadow:inset 0 1px .5px rgba(255,255,255,.85),0 10px 30px -10px rgba(0,0,0,.22)}header a{color:var(--ink);font-size:17px;font-weight:700;letter-spacing:-.02em;text-decoration:none}header a span{color:var(--blue)}main{width:min(460px,calc(100% - 32px));margin:10vh auto;padding:34px 32px;background:var(--surface);border:1px solid var(--card-border);backdrop-filter:saturate(180%) blur(24px);-webkit-backdrop-filter:saturate(180%) blur(24px);border-radius:28px;box-shadow:0 20px 48px -18px rgba(0,0,0,.38);text-align:center}.avatar{width:68px;height:68px;margin:0 auto 14px;border-radius:50%;overflow:hidden;border:2.5px solid rgba(255,255,255,.85);box-shadow:0 8px 20px rgba(0,0,0,.18)}.avatar img{display:block;width:100%;height:100%;object-fit:cover}.eyebrow{color:var(--blue);letter-spacing:.1em;font-size:12px;font-weight:650;text-transform:uppercase}h1{font-size:28px;font-weight:750;line-height:1.25;letter-spacing:-.025em;margin:6px 0 10px}p{color:var(--muted);margin:0 0 12px}.button{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:46px;margin:22px 0 16px;background:var(--blue);color:#fff;border-radius:999px;font-weight:600;text-decoration:none}.button:hover{background:var(--blue-h)}.back{color:var(--blue);font-size:14px;font-weight:500;text-decoration:none}.back:hover{text-decoration:underline}.note{font-size:13px;margin-top:22px;padding-top:18px;border-top:1px solid var(--sep)}svg{width:20px;height:20px;fill:currentColor}@media(max-width:600px){main{margin:7vh auto;padding:26px 22px;border-radius:24px}h1{font-size:25px}}@media(prefers-color-scheme:dark){:root{--surface:rgba(28,28,30,.82);--ink:#f5f5f7;--muted:rgba(235,235,245,.7);--sep:rgba(255,255,255,.12);--blue:#0a84ff;--blue-h:#409cff;--glass:rgba(36,36,40,.72);--g-border:rgba(255,255,255,.16);--scrim:linear-gradient(180deg,rgba(4,8,18,.58),rgba(0,0,0,.78));--card-border:rgba(255,255,255,.14)}}
  </style></head><body><header><a href="${env.BLOG_URL}">Theodore<span>.</span></a></header><main><div class="avatar"><img src="/assets/img/avatar.png" width="68" height="68" alt="Theodore"></div><span class="eyebrow">THEODORE · 写作后台</span><h1>${title}</h1><p>${message}</p><a class="button" href="/auth/login?next=${encodeURIComponent(next)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.3c-3.3.7-4-1.4-4-1.4-.5-1.3-1.3-1.6-1.3-1.6-1.1-.8.1-.8.1-.8 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6a4.7 4.7 0 0 1 1.2-3.2c-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1a4.7 4.7 0 0 1 1.2 3.2c0 4.7-2.8 5.7-5.5 6 .5.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6A12 12 0 0 0 12 .5z"/></svg>使用 GitHub 登录</a><a class="back" href="${env.BLOG_URL}">← 返回博客阅读</a><p class="note">此处仅供博客作者使用。登录其他 GitHub 账号无法进入管理页。</p></main></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
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
      return Response.json({ ok: true, configured });
    }
    if (url.pathname === '/auth/logout' && request.method === 'POST') {
      if (request.headers.get('Origin') !== origin) return new Response('Forbidden', { status: 403 });
      const response = redirect('/');
      response.headers.append('Set-Cookie', cookie(SESSION, '', 0));
      response.headers.append('Set-Cookie', cookie(OAUTH, '', 0));
      return response;
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
