# DEPLOYMENT.md

> Lumi 部署架构详细指南（v1.3）

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    开发者 (你的本地电脑)                        │
│  git push origin main                                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    GitHub (ruisheng2266/lumi)                │
│  • main 分支                                                   │
│  • Secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID      │
│  • Workflows: .github/workflows/deploy.yml                   │
└────────────────────────┬────────────────────────────────────┘
                         │ (push 触发)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              GitHub Actions Runner (Ubuntu)                  │
│  1. Checkout code                                             │
│  2. Setup Node 20 + npm cache                                 │
│  3. npm ci (安装依赖)                                          │
│  4. npm test (V1.5: validation/ 50 cases)                                      │
│  5. npm run type-check (TypeScript)                            │
│  6. npm run build (生成 dist/)                                 │
│  7. cloudflare/pages-action@v1 (上传到 Cloudflare)             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            Cloudflare Pages (全球 CDN)                        │
│  • 项目：lumi                                                  │
│  • 域名：lumi365.com (主) / lumi-6au.pages.dev (备用)                                    │
│  • 构建命令：npm run build                                     │
│  • 输出目录：dist                                               │
│  • 自动 HTTPS                                                  │
└─────────────────────────────────────────────────────────────┘
```

## 🔑 首次部署配置

### Step 1: Cloudflare Pages 项目

**选项 A：通过 Dashboard（OAuth，需要浏览器）**

```
1. 登录 https://dash.cloudflare.com
2. 左侧 Workers & Pages → Create application
3. Pages 标签 → Connect to Git
4. 选择 GitHub → 授权 ruisheng2266/lumi
5. 构建设置：
   - Framework preset: Vite
   - Build command: npm run build
   - Build output directory: dist
   - Node version: 20
6. Save and Deploy
```

**选项 B：通过 API（无需浏览器，本文档使用此方式）**

```powershell
$env:CF_TOKEN = '<your-token>'
$env:CF_ACCOUNT = '<your-account-id>'
$headers = @{ Authorization = "Bearer $env:CF_TOKEN"; "Content-Type" = "application/json" }

$body = @{
  name = "lumi"
  production_branch = "main"
  build_config = @{
    build_command = "npm run build"
    destination_dir = "dist"
    root_dir = ""
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/accounts/$env:CF_ACCOUNT/pages/projects" `
  -Method Post -Headers $headers -Body $body
```

### Step 2: GitHub Secrets

**需要的 Secrets**：

| Name | 说明 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（需 Pages:Edit 权限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |

**配置步骤**：

```
1. 获取 API Token：
   https://dash.cloudflare.com → 右上角头像 → My Profile
   → API Tokens → Create Token
   → 选模板 "Edit Cloudflare Pages"（推荐）
   → 或自定义：Account → Workers/Pages:Edit
   → TTL: 30 天 → Create → 复制 token

2. 获取 Account ID：
   Cloudflare Dashboard 右下角

3. 配置 GitHub Secrets：
   GitHub 仓库 → Settings → Secrets and variables → Actions
   → New repository secret
   → Name: CLOUDFLARE_API_TOKEN  Value: <token>
   → Name: CLOUDFLARE_ACCOUNT_ID  Value: <account-id>
```

### Step 3: 触发首次部署

任一方式：
- `git push origin main`（自动）
- GitHub UI → Actions → Deploy workflow → Run workflow（手动）
- GitHub API: `POST /repos/{owner}/{repo}/actions/workflows/deploy.yml/dispatches`

## 🔁 日常部署流程

```powershell
# 1. 开发
git add -A
git commit -m "feat: add new feature"

# 2. 推送
git push origin main

# 3. 自动部署（约 1-2 分钟）
# 查看进度：
# GitHub: 仓库 → Actions → Deploy workflow
# Cloudflare: 仓库 → Settings → Builds
```

## 📦 构建产物

`npm run build` 输出 `dist/`：

```
dist/
├── index.html              0.62 kB  (gzip: 0.49 kB)
├── assets/
│   ├── index-xxx.css      ~18 kB    (gzip: ~4 kB)
│   └── index-xxx.js       ~417 kB   (gzip: ~136 kB)
├── _headers                          ← Cloudflare 安全头（含 CSP V1.4）
├── _redirects                        ← SPA 路由 fallback
├── manifest.webmanifest              ← PWA manifest（V1.4）
├── sw.js                             ← Service Worker（V1.4）
└── favicon.svg
```

总大小：~140 KB gzip（首屏极快）

## 🛡️ 安全头（`_headers`，V1.4）

部署时 Cloudflare 自动应用以下头（V1.4 实际值）：

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://accounts.google.com https://www.googleapis.com https://openidconnect.googleapis.com; worker-src 'self' blob:; manifest-src 'self'; base-uri 'self'; form-action 'self' https://accounts.google.com; frame-ancestors 'none'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp

/index.html
  Cache-Control: no-cache, no-store, must-revalidate

/sw.js
  Cache-Control: no-cache, no-store, must-revalidate
```

关键说明：
- **`connect-src` 严格限制 + Google 域白名单**（V1.4）：`accounts.google.com` / `www.googleapis.com` / `openidconnect.googleapis.com` 仅供 OAuth 流程；**健康数据相关请求保持零网络**。
- **`frame-ancestors 'none'`** 防点击劫持。
- **`Cross-Origin-Embedder-Policy: require-corp`** 启用跨源隔离（SharedArrayBuffer 等高级 API 前提）。
- **`/sw.js` 不缓存** 确保 Service Worker 立即生效。

## 🔀 SPA 路由（`_redirects`）

```
/*    /index.html   200
```

React Router 处理客户端路由（`/today`、`/calendar` 等非根路径），刷新时不报 404。

## 🌍 自定义域名（可选）

```
1. Cloudflare Dashboard → Workers & Pages → lumi → Custom domains
2. Add custom domain → 输入（如 lumi.app）
3. Cloudflare 自动配置 DNS
4. 等待 SSL 证书签发（< 1 分钟）

国内域名备选：
- 国内备案流程麻烦，建议用 Cloudflare 域名 + 国内 CDN 镜像
- 同一份 dist/ 产物可分发到阿里云 OSS / 腾讯云 COS
```

## ⚙️ 环境变量（V1.4）

V1.4 起，前端会用到以下变量（用于账号系统 OAuth）：

- **公开变量**（写入 `wrangler.toml` 的 `[vars]`，可提交）：
  - `PUBLIC_URL`：站点主域名（如 `https://lumi365.com`）
  - `GOOGLE_CLIENT_ID`：Google OAuth Web Client ID
- **私密变量**（通过 Dashboard 或 `wrangler pages secret put` 注入）：
  - `GOOGLE_CLIENT_SECRET`：Google OAuth Web Client Secret

```bash
# 通过 Dashboard 注入：
# Cloudflare Dashboard → lumi → Settings → Environment variables → Production
# 添加 GOOGLE_CLIENT_SECRET = <your-secret>

# 或通过 wrangler CLI：
wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name=lumi
```

## 🐛 故障排查

### 构建失败
```bash
# 本地复现
npm ci
npm test
npm run type-check
npm run build
```

### 部署后页面空白
1. 检查 Cloudflare Dashboard → lumi → Builds → 最新构建日志
2. 检查浏览器控制台错误
3. 验证 `_redirects` 配置存在

### CSP 报错
如果有第三方资源被 CSP 拦截，需调整 public/_headers 中的对应指令。

**V1.4 CSP 已白名单**：仅 https://accounts.google.com / https://*.googleapis.com（含 openidconnect.googleapis.com）。其他任何第三方域都会触发 CSP 报错，需要明确评估是否纳入白名单——谨慎行事，这会降低安全性。

### 性能问题
- Lighthouse 在 Cloudflare 边缘节点跑分通常 ≥ 95
- 如果下降，检查 bundle size（`npm run build` 输出）
- 考虑用 Vite 的 `manualChunks` 拆分 recharts 等大依赖

## 🔙 回滚

```
GitHub → 仓库 → Actions → Deploy workflow → 找到上一个成功的 run
→ 点 run → Summary 右侧 "Re-run jobs" 下拉菜单 → "Re-run all jobs"
```

或手动：
```
Cloudflare Dashboard → lumi → Deployments → 找到上一个成功部署 → "Rollback to this deploy"
```

## 📊 监控

Lumi V1 **不使用任何第三方分析**（隐私承诺）。可选自托管分析：
- [Plausible](https://plausible.io)（隐私友好，CDN-hosted）
- [Umami](https://umami.is)（自托管）

如需启用，建议：
- 不记录 URL 路径中的敏感数据（如 `/log`）
- 不使用 Cookie
- 完全匿名 IP（截断 IPv4 最后一段）

## 🔄 Token 轮换

### 定期轮换

```
建议：每 90 天轮换一次 Cloudflare API Token
```

### 紧急轮换

如 Token 泄露（如本项目曾发生的事故）：

```
1. Cloudflare Dashboard → API Tokens → 找到泄露的 token → Revoke
2. 重新生成 token
3. 更新 GitHub Secret（参考本指南 Step 2）
4. 验证部署仍工作（push 或手动触发）
5. 在 CHANGELOG 中记录此次事件
```

详细过程：见 git history `615f073`（泄露事故）→ `fd38d70`（修复）

## 📝 部署检查清单（DoD，V1.4）

新部署前确认：

- [ ] 所有测试通过：`cd validation && npm test`（50/50）
- [ ] 类型检查通过（`npm run type-check`）
- [ ] 构建成功（`npm run build`）
- [ ] 本地预览正常（`npm run preview`）
- [ ] CSP 头正确（`curl -I https://lumi365.com`，应见 V1.4 实际值）
- [ ] 404 fallback 正常（访问 `/today` 不报错）
- [ ] PWA manifest 加载（浏览器 DevTools → Application → Manifest）
- [ ] Service Worker 注册（DevTools → Application → Service Workers）
- [ ] 主题切换工作（Settings → 深色 → 全站颜色变量切换）
- [ ] 数据导出 / 清空正常（Onboarding → 记录 → Settings → 导出 JSON）
- [ ] **V1.4 账号系统**（如启用）：
  - [ ] `wrangler.toml` 中 `PUBLIC_URL` / `GOOGLE_CLIENT_ID` 已设
  - [ ] Cloudflare Dashboard 中 `GOOGLE_CLIENT_SECRET` 已注入
  - [ ] D1 数据库 `lumi-db` 已创建并绑定
  - [ ] Pages Functions `/auth/login|callback|logout|me` 部署成功
  - [ ] Google Cloud Console 中 OAuth 重定向 URI 已配置
  - [ ] 测试登录流程（Settings → 用 Google 登录 → 跳转 → 头像显示）

---

## OAuth 配置（Google 登录）

如果需要启用 Google 登录功能（用户身份识别），需要以下配置。

### 步骤 1：Google Cloud Console

#### 1.1 创建项目 + 启用 API
```
1. 打开 https://console.cloud.google.com/
2. 顶部项目下拉框 → 新建项目
3. 项目名称：lumi
4. 左侧 → API 和服务 → 库
5. 搜索并启用：
   - Google Identity Services
   - People API
```

#### 1.2 配置 OAuth 同意屏幕
```
1. 左侧 → OAuth 同意屏幕
2. 用户类型：外部 → 创建
3. 填写应用名称、用户支持邮箱、开发者联系邮箱
4. 范围：openid, email, profile
5. 测试用户：加你自己的 Gmail
```

#### 1.3 创建 OAuth 客户端 ID
```
1. 左侧 → 凭据 → 创建凭据 → OAuth 客户端 ID
2. 应用类型：Web 应用
3. 名称：Lumi Web Client
4. 已授权的 JavaScript 来源：
   - https://lumi365.com
   - https://www.lumi365.com
   - http://localhost:5173（本地开发）
5. 已授权的重定向 URI（关键！）：
   - https://lumi365.com/auth/callback
   - https://www.lumi365.com/auth/callback
   - http://localhost:5173/auth/callback（开发）
6. 创建 → 复制 Client ID 和 Client Secret
```

### 步骤 2：Cloudflare D1 数据库
```bash
wrangler login
wrangler d1 create lumi-db
```
记下输出的 database_id。Schema 见 functions/utils/db.ts 注释（users + sessions 两张表）。

### 步骤 3：Pages Functions 代码
本项目已包含完整代码在 functions/ 目录：
- functions/auth/login.ts - 发起 OAuth
- functions/auth/callback.ts - 回调处理
- functions/auth/logout.ts - 登出
- functions/auth/me.ts - 当前用户
- functions/utils/db.ts - D1 助手
- functions/utils/session.ts - 会话管理

### 步骤 4：wrangler.toml
```toml
name = "lumi"
compatibility_date = "2026-07-24"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "lumi-db"
database_id = "<你的 database_id>"

[vars]
PUBLIC_URL = "https://lumi365.com"
GOOGLE_CLIENT_ID = "<你的 client_id>"
```

### 步骤 5：部署 + 环境变量
代码 push 后 GitHub Action 自动部署。

在 Cloudflare Dashboard 添加 Secret：
```
1. Cloudflare Dashboard → Workers & Pages → lumi
2. Settings → Environment variables → Production
3. 添加：GOOGLE_CLIENT_SECRET = <你的 secret>
```

或用 wrangler CLI：
```bash
wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name=lumi
```

### 步骤 6：更新 CSP

本项目的 `public/_headers` 已包含 V1.4 的完整 CSP（参见上文 §安全头）。如果你 fork 后自定义过 `_headers`，需要确保：

- `script-src` 包含 `https://accounts.google.com`
- `connect-src` 包含 `https://accounts.google.com` 和 `https://*.googleapis.com`
- `form-action` 包含 `https://accounts.google.com`

其余指令（`default-src`、`frame-ancestors`、`X-Frame-Options` 等）保持默认。

### 步骤 7：测试
```
1. 访问 https://lumi365.com/settings
2. 点击 "用 Google 登录"
3. 在 Google 登录页选择账号
4. 同意授权
5. 跳回 lumi365.com，Settings 应显示你的头像
```

### 步骤 8：查看 D1 数据
**方法 1：Cloudflare Dashboard**
Cloudflare Dashboard → Workers & Pages → D1 → lumi-db → Console
执行 SQL：SELECT * FROM users;

**方法 2：wrangler CLI**
```bash
wrangler d1 execute lumi-db --remote --command "SELECT * FROM users"
```

**方法 3：Cloudflare API**
通过 REST API 查询（需要 API Token）。

---


## 📱 PWA（V1.4 新增）

部署后自动启用 PWA：

- 打开 https://lumi365.com → 浏览器地址栏右侧出现安装 Lumi 按钮
- iOS Safari → 分享 → 添加到主屏
- Android Chrome → 菜单 → 添加到主屏

文件：
- public/manifest.webmanifest (名称、图标、shortcuts)
- public/sw.js（service worker，network-first + cache fallback）
## 📚 相关资源

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [cloudflare/pages-action](https://github.com/cloudflare/pages-action)
- [PRD §11.4 部署架构](./docs/MVP-PRD.md#114-部署架构)

---

> 最后更新：2026-07-27（v1.4）