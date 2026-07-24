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
│  4. npm test (50 单元测试)                                      │
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
├── _headers                          ← Cloudflare 安全头
├── _redirects                        ← SPA 路由 fallback
└── favicon.svg
```

总大小：~140 KB gzip（首屏极快）

## 🛡️ 安全头（`_headers`）

部署时 Cloudflare 自动应用以下头：

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; worker-src 'self' blob:; manifest-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=(), usb=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp

/index.html
  Cache-Control: no-cache, no-store, must-revalidate
```

关键说明：
- **`connect-src 'none'`** 是隐私承诺的核心 — 物理禁止任何网络请求
- **`frame-ancestors 'none'`** 防点击劫持
- **`Cross-Origin-Embedder-Policy: require-corp`** 启用跨源隔离（SharedArrayBuffer 等高级 API 前提）

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

## ⚙️ 环境变量

V1 不需要环境变量（纯前端，无后端）。如果未来 V2+ 需要：

```
Cloudflare Dashboard → lumi → Settings → Environment variables
```

或在 `.github/workflows/deploy.yml` 中通过 `env:` 注入。

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
如果有第三方资源被 CSP 拦截，需调整 `public/_headers` 中的对应指令。例如添加 `script-src 'self' 'unsafe-eval'`，但要谨慎 — 这会降低安全性。

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

## 📝 部署检查清单（DoD）

新部署前确认：

- [ ] 所有测试通过（`npm test` 50/50）
- [ ] 类型检查通过（`npm run type-check`）
- [ ] 构建成功（`npm run build`）
- [ ] 本地预览正常（`npm run preview`）
- [ ] CSP 头正确（`curl -I https://lumi365.com`）
- [ ] 404 fallback 正常（访问 `/today` 不报错）
- [ ] 数据导入导出正常（Onboarding → 记录 → Settings → 导出 JSON）

---

## 📚 相关资源

- [Cloudflare Pages 文档](https://developers.cloudflare.com/pages)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [cloudflare/pages-action](https://github.com/cloudflare/pages-action)
- [PRD §11.4 部署架构](./docs/MVP-PRD.md#114-部署架构)

---

> 最后更新：2026-07-24（v1.3）