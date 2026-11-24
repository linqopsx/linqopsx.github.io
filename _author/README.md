# 作者写作入口

博客仍部署在 GitHub Pages。`/admin/` 及原管理地址只显示登录入口；真正的管理页面由独立的 Cloudflare Worker 提供。

Worker 使用 GitHub OAuth（不申请额外 scope，只读取公开身份），固定核验作者数字 ID `240416179`。只有该账号可取得 8 小时的 HttpOnly、Secure、SameSite=Lax 签名会话。OAuth 使用 state、PKCE 和 10 分钟的签名临时 cookie。身份验证在静态资源之前执行：`assets.run_worker_first` 必须保持 `true`。后台 HTML、配置和脚本均不允许匿名直读，也不使用浏览器或 CDN 缓存。

`public/admin/` 是受保护的静态界面源文件，不包含私人文章或登录凭证。文章编辑仍由 Pages CMS 的 GitHub 应用负责；软件上传、访问统计沿用各自的平台登录。退出本后台只清除本后台的登录会话。

## 配置与部署

1. 在作者账号创建 GitHub OAuth App，主页为博客地址，回调地址为 `PUBLIC_URL` 加 `/auth/callback`。
2. 在 `wrangler.jsonc` 配置公开的 Client ID；更换账号时同步核验并修改 `AUTHOR_ID`。
3. 通过 `wrangler secret put` 配置 `GITHUB_CLIENT_SECRET` 和至少 32 字节随机生成的 `SESSION_SECRET`。只通过标准输入传入秘密，不将其存入文件、命令参数或仓库。
4. 运行 `node --test test/*.test.mjs`，再运行 `wrangler deploy`。项目不需要数据库。
5. 同时验证匿名用户不能读取 `/admin/` 和 `/admin/config.json`，以及作者实际登录后可正常使用管理页。

`/health` 仅返回服务状态和配置是否完整。修改 `SESSION_SECRET` 可使已有会话全部失效。若更换 Worker 地址，需要同步更新 GitHub OAuth 回调地址和公开博客的 `_layouts/author-login.html`。

Jekyll 自动忽略 `_author` 目录；公开部署产物不得包含此目录或受保护的管理页。
