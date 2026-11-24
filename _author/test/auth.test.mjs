import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApp } from '../src/worker.mjs';

const origin = 'https://author.example';
const sessionName = '__Host-blog_author';
const oauthName = '__Host-blog_oauth';

function fixture({ id = 240416179, fail = false } = {}) {
  let time = 100000;
  const upstream = [];
  const assets = [];
  const env = {
    PUBLIC_URL: origin, BLOG_URL: 'https://linqopsx.github.io', AUTHOR_ID: '240416179',
    GITHUB_CLIENT_ID: 'test-client', GITHUB_CLIENT_SECRET: 'test-client-secret',
    SESSION_SECRET: 'this-is-a-test-signing-key-with-at-least-32-bytes',
    ASSETS: { async fetch(request) {
      assets.push(request.url);
      return new Response('protected dashboard', { headers: { 'Cache-Control': 'public, max-age=3600' } });
    } }
  };
  const app = createApp({ now: () => time, fetchImpl: async (url, init) => {
    upstream.push({ url: String(url), init });
    if (fail) throw new Error('test network failure');
    if (String(url) === 'https://github.com/login/oauth/access_token') return Response.json({ access_token: 'test-oauth-token' });
    if (String(url) === 'https://api.github.com/user') return Response.json({ id, login: 'linqopsx' });
    return new Response('public stylesheet', { headers: { 'Content-Type': 'text/css' } });
  } });
  const send = (path, options) => app.fetch(new Request(origin + path, options), env);
  return { env, send, upstream, assets, advance: seconds => { time += seconds; } };
}

function getCookie(response, name) {
  return response.headers.getSetCookie().find(value => value.startsWith(name + '='))?.split(';')[0];
}

async function startLogin(site, next = '/admin/downloads/') {
  const response = await site.send('/auth/login?next=' + encodeURIComponent(next));
  const location = new URL(response.headers.get('Location'));
  return { response, location, cookie: getCookie(response, oauthName), state: location.searchParams.get('state') };
}

async function finishLogin(site, login) {
  return site.send('/auth/callback?code=test-code&state=' + login.state, { headers: { Cookie: login.cookie } });
}

test('anonymous visitors cannot read any protected management document or asset', async () => {
  const site = fixture();
  for (const path of ['/admin', '/admin/', '/admin/index.html', '/admin/downloads/', '/admin/config.json', '/admin/private/config.json', '/admin/vendor/sveltia-cms.js']) {
    const response = await site.send(path);
    assert.equal(response.status, 401, path);
    assert.match(await response.text(), /作者登录/);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  }
  assert.equal(site.assets.length, 0);
});

test('GitHub login uses state, PKCE and no repository or email scopes', async () => {
  const site = fixture();
  const login = await startLogin(site);
  assert.equal(login.response.status, 303);
  assert.equal(login.location.origin, 'https://github.com');
  assert.equal(login.location.pathname, '/login/oauth/authorize');
  assert.equal(login.location.searchParams.get('scope'), '');
  assert.equal(login.location.searchParams.get('redirect_uri'), origin + '/auth/callback');
  assert.equal(login.location.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(login.location.searchParams.get('code_challenge').length, 43);
  const header = login.response.headers.get('Set-Cookie');
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=600']) assert.ok(header.includes(flag));
});

test('only the fixed numeric author identity can obtain a session', async () => {
  const site = fixture();
  const login = await startLogin(site);
  const callback = await finishLogin(site, login);
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get('Location'), '/admin/downloads/');
  const session = getCookie(callback, sessionName);
  assert.ok(session);
  assert.match(callback.headers.get('Set-Cookie'), /Max-Age=28800/);
  assert.match(callback.headers.get('Set-Cookie'), /__Host-blog_oauth=; Max-Age=0/);
  for (const path of ['/admin/', '/admin/config.json', '/admin/private/']) {
    const response = await site.send(path, { headers: { Cookie: session } });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'protected dashboard');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('Vary'), 'Cookie');
  }
  const exchange = site.upstream[0].init.body;
  assert.equal(exchange.get('redirect_uri'), origin + '/auth/callback');
  assert.equal(exchange.get('code_verifier').length, 43);
  assert.equal(site.upstream[1].init.headers.Authorization, 'Bearer test-oauth-token');
});

test('a different account is denied even when its login name matches the author', async () => {
  const site = fixture({ id: 9999 });
  const callback = await finishLogin(site, await startLogin(site));
  assert.equal(callback.status, 403);
  assert.equal(getCookie(callback, sessionName), sessionName + '=');
  const text = await callback.text();
  assert.match(text, /没有写作后台权限/);
  assert.ok(!text.includes('test-oauth-token'));
  assert.equal(site.assets.length, 0);
});

test('missing, mismatched and expired OAuth states do not contact GitHub', async () => {
  const site = fixture();
  const login = await startLogin(site);
  const missing = await site.send('/auth/callback?code=test-code&state=' + login.state);
  assert.equal(missing.status, 400);
  const mismatch = await site.send('/auth/callback?code=test-code&state=wrong', { headers: { Cookie: login.cookie } });
  assert.equal(mismatch.status, 400);
  site.advance(601);
  assert.equal((await finishLogin(site, login)).status, 400);
  assert.equal(site.upstream.length, 0);
});

test('forged, expired, and OAuth cookies cannot be used as author sessions', async () => {
  const site = fixture();
  const login = await startLogin(site);
  const session = getCookie(await finishLogin(site, login), sessionName);
  const [name, value] = session.split('=');
  const [body, signature] = value.split('.');
  const changed = (signature[0] === 'a' ? 'b' : 'a') + signature.slice(1);
  for (const cookie of [name + '=' + body + '.' + changed, sessionName + '=bad-cookie', sessionName + '=' + login.cookie.split('=')[1]]) {
    assert.equal((await site.send('/admin/', { headers: { Cookie: cookie } })).status, 401);
  }
  site.advance(28800);
  assert.equal((await site.send('/admin/', { headers: { Cookie: session } })).status, 401);
  assert.equal(site.assets.length, 0);
});

test('logout requires a same-origin POST and clears both authentication cookies', async () => {
  const site = fixture();
  const crossOrigin = await site.send('/auth/logout', { method: 'POST', headers: { Origin: 'https://other.example' } });
  assert.equal(crossOrigin.status, 403);
  assert.equal(crossOrigin.headers.get('Set-Cookie'), null);
  const response = await site.send('/auth/logout', { method: 'POST', headers: { Origin: origin } });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('Location'), '/');
  assert.equal(response.headers.getSetCookie().length, 2);
  for (const item of response.headers.getSetCookie()) assert.ok(item.includes('Max-Age=0'));
  assert.equal((await site.send('/auth/logout')).headers.get('Set-Cookie'), null);
});

test('untrusted return URLs never redirect outside the author site', async () => {
  for (const path of ['https://other.example/admin/', '//other.example/admin/', '/downloads/', '/admin/../../public', 'https://[']) {
    const site = fixture();
    const callback = await finishLogin(site, await startLogin(site, path));
    assert.equal(callback.headers.get('Location'), '/admin/');
  }
});

test('missing secrets and GitHub failures fail closed without leaking credentials', async () => {
  const missing = fixture();
  delete missing.env.SESSION_SECRET;
  assert.equal((await missing.send('/admin/')).status, 503);
  assert.equal(missing.assets.length, 0);
  const failed = fixture({ fail: true });
  const response = await finishLogin(failed, await startLogin(failed));
  assert.equal(response.status, 502);
  const text = await response.text();
  for (const value of ['test-client-secret', 'test-code', 'test-oauth-token']) assert.ok(!text.includes(value));
});

test('public styling never forwards browser credentials, and static assets cannot bypass the Worker', async () => {
  const site = fixture();
  const response = await site.send('/assets/css/morning.css', { headers: { Cookie: 'a=private', Authorization: 'Bearer private' } });
  assert.equal(response.headers.get('Content-Type'), 'text/css');
  assert.equal(site.upstream[0].url, 'https://linqopsx.github.io/assets/css/morning.css');
  assert.equal(site.upstream[0].init.headers, undefined);
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.assets.run_worker_first, true);
  assert.equal(config.preview_urls, false);
});
