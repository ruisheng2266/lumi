# Lumi

> 温柔、私密、只属于你的女性健康追踪工具。

[![CI](https://github.com/ruisheng2266/lumi/actions/workflows/deploy.yml/badge.svg)](https://github.com/ruisheng2266/lumi/actions/workflows/deploy.yml)

Lumi 是一款**本地优先**的网页应用（PWA），帮助你追踪月经周期、排卵预测、健康日记，并提供基于本地算法的 AI 洞察。

**🌐 在线访问**：<https://lumi365.com>（备用：<https://lumi-6au.pages.dev>）

---

## ✨ 核心理念

- 🚫 **零云端（健康数据）** — 月经/症状/日记等健康数据只存在你自己的浏览器中（IndexedDB），不向任何服务器上传
- 🔐 **可选账号系统（V1.4）** — Google OAuth 登录后，偏好（语言/主题）会同步到 Cloudflare D1；身份与会话通过 HTTP-only Cookie 管理
- 🤖 **本地 AI** — 洞察基于本地规则引擎，不调用任何外部 AI 服务
- 🌿 **温和设计** — 避免焦虑制造，拥抱真实身体
- 🆓 **完全免费** — 永远无广告、无追踪、无订阅墙

## 🎯 核心功能

| 功能 | 描述 |
| --- | --- |
| **周期追踪** | 记录月经开始/结束、流量；自动计算周期长度与规律性 |
| **排卵预测** | 基于平均周期 + 黄体期常数预测下次月经、排卵日、易孕窗口 |
| **健康日记** | 每日记录：情绪（emoji）、精力、睡眠、症状、备注 |
| **AI 洞察** | 6 类本地洞察：周期规律性、PMS 模式、精力-阶段关联、睡眠-情绪、阶段提醒、异常检测 |
| **月历视图** | 一目了然的周期状态：经期、易孕窗、今日 |
| **数据导出** | 一键导出 JSON 备份；可跨设备迁移 |
| **双语支持** | 简体中文 / English，运行时切换，无需刷新 |
| **用户系统（V1.4）** | 可选 Google OAuth 登录，偏好跨设备同步；健康数据始终仅本地 |

## 🔐 用户系统（V1.4，可选）

Lumi V1.4 起支持 Google 账号登录。账号系统是**完全可选**的——不登录也能使用全部核心功能。

- **登录方式**：Google OAuth 2.0（前端 → accounts.google.com → 回调到 Pages Function）
- **用户数据存储**：Cloudflare D1（SQLite），仅保存 Google profile（id / email / name / picture）
- **会话方式**：HTTP-only + Secure + SameSite=Lax Cookie（30 天有效）
- **同步范围**：语言偏好、主题、入职状态；**不**同步健康数据
- **健康数据**：始终仅存在 IndexedDB（不上传）

**隐私边界**：登录后你的**身份信息**会存到 D1，但**健康数据**依然**只存在你浏览器本地**。DevTools Network 面板可验证——健康数据相关请求保持零网络。

详细配置：参见 [DEPLOYMENT.md §OAuth](./DEPLOYMENT.md#oauth-配置google-登录) 和 [PRD §11.5](./docs/MVP-PRD.md)。

## 🎨 主题切换（V1.4）

Lumi V1.4 支持浅色 / 深色模式：

- 设置 → 主题（浅色 / 深色两选一）
- 选择持久化到 IndexedDB
- 颜色用 CSS 变量定义，切换无闪烁
- dark class 加在 <html> 元素上

## 📱 PWA（V1.4）

Lumi V1.4 支持安装到桌面 / 主屏：

- public/manifest.webmanifest 含名称、图标、shortcuts
- public/sw.js 网络优先 + 缓存回退
- iOS / Android 可添加到主屏
- 离线后仍可访问已浏览页面

---

## 🛠️ 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | React 18 + TypeScript + Vite 5 |
| 路由 | React Router v6 |
| 样式 | Tailwind CSS |
| 数据 | Dexie.js (IndexedDB) |
| 日期 | date-fns（locale-aware） |
| 国际化 | react-i18next |
| 图表 | recharts |
| 状态 | Zustand |
| 测试 | Vitest + Testing Library + fake-indexeddb |
| 部署 | Cloudflare Pages（GitHub Action 自动） |

## 🚀 快速开始

### 环境要求
- Node.js ≥ 20
- npm ≥ 10

### 本地开发

```bash
# 安装依赖（一次；包含根 + validation 全部依赖）
npm install

# 启动 dev server（http://localhost:5173）
npm run dev

# 运行单元测试（自动发现 src/ + validation/src/）
npm test

# 类型检查
npm run type-check

# 生产构建
npm run build

# 预览生产构建
npm run preview
```

### 第一次使用

1. 打开应用 → 选择语言（zh-CN / en）
2. 输入昵称（可选）
3. 选择最近一次月经开始日
4. 调整平均周期（默认 28 天，可调 21~45）
5. 进入 Today 页面，开始记录

## 📁 项目结构

```
lumi/
├── docs/
│   └── MVP-PRD.md           # 完整产品需求文档（v1.6）
├── functions/             # Cloudflare Pages Functions（V1.4：OAuth /auth/login|callback|logout|me）
├── public/
│   ├── _headers             # Cloudflare 安全头（含 CSP V1.4）
│   ├── _redirects           # SPA fallback
│   ├── manifest.webmanifest # PWA manifest（V1.4）
│   ├── sw.js                # Service Worker（V1.4：network-first + cache fallback）
│   └── favicon.svg
├── src/
│   ├── app/
│   │   └── AppShell.tsx     # 应用外壳（5 项底部导航）
│   ├── pages/               # 页面：Onboarding / Today / Calendar / Log / Insights / Settings
│   ├── features/
│   │   ├── LogSheet.tsx     # 快速记录抽屉
│   │   └── MonthCalendar.tsx# 月历组件
│   ├── shared/
│   │   ├── db/              # Dexie schema + repositories
│   │   ├── lib/             # 纯函数：predict / insights / date
│   │   ├── i18n/            # 国际化配置 + hooks
│   │   └── ui/              # 原子组件：Button / Card / Chip / IconButton / Sheet
│   ├── styles/
│   │   └── globals.css      # Tailwind + 全局样式
│   ├── App.tsx              # 根组件 + 路由
│   └── main.tsx             # 入口
├── validation/              # 独立技术验证 PoC（50 测试）
│   ├── src/
│   │   ├── predict.test.ts  # 21 测试
│   │   ├── db.test.ts       # 10 测试
│   │   ├── i18n.test.ts     # 9 测试
│   │   └── insights.test.ts # 10 测试
│   └── README.md            # 验证报告
├── .github/
│   └── workflows/
│       └── deploy.yml       # GitHub Action → Cloudflare Pages
├── wrangler.toml            # Cloudflare 配置（D1 binding + OAuth vars，V1.4）
├── DEPLOYMENT.md            # 部署详细指南（含 OAuth 章节）
├── CONTRIBUTING.md          # 贡献指南
├── SECURITY.md              # 安全策略
└── LICENSE                  # MIT
```

## 🔒 隐私 & 安全

Lumi **不向任何服务器上传健康数据**。可通过浏览器 DevTools → Network 面板验证：健康数据相关操作全程零网络请求。

**V1.4 起**：账号系统会向 `accounts.google.com` / `googleapis.com` 发起 OAuth 请求（仅在用户主动点击"用 Google 登录"时）。这些请求只携带身份与偏好信息，**不包含任何健康数据**。

技术保障：
- ✅ **CSP（V1.4）**：`connect-src` 严格限制；仅对 Google OAuth / Google API 域放行，用于账号系统（PRD §11.5）。其余默认 `'self'` + `'none'`
- ✅ **HTTPS**：Cloudflare 自动签发 + 自动续期
- ✅ **HSTS**：max-age=1 年 + includeSubDomains
- ✅ **X-Frame-Options: DENY**：防点击劫持
- ✅ **Referrer-Policy: no-referrer**：不发送来源信息
- ✅ **Permissions-Policy**：禁用定位、相机、麦克风等所有设备权限
- ✅ **Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy**：跨源隔离
- ✅ **数据导出**：JSON 自描述格式，含 `schemaVersion` 字段
- ✅ **数据删除**：一键清空所有 IndexedDB，不可恢复

详细：[SECURITY.md](./SECURITY.md)

## 🌐 国际化

V1 支持：
- 🇨🇳 简体中文（zh-CN，默认）
- 🇺🇸 English（en）

新增语言仅需：
1. 在 `src/shared/i18n/config.ts` 的 `resources` 中添加翻译
2. 在 `LOCALE_META` 中添加元数据
3. （V1.5 收尾）拆分为按目录加载的 JSON 文件，对齐 PRD §6.5.3 的 `locales/{lang}/*.json` 结构

无需修改组件代码。

文案规范：
- 避免性别刻板印象
- 医学术语使用统一术语表（见 PRD §6.5.8）
- 长度控制：核心按钮中英长度差不超过 2 倍

## 🧪 测试

```bash
# 在 validation/ 目录下（独立验证包，含全部核心算法测试）
cd validation
npm install
npm test           # 运行全部 50 测试
npm run test:watch # 监听模式
```

> ℹ️ 仓库根目录的 `npm test` 当前指向 `src/test/setup.ts` 而非 `validation/` 下的用例。
> V1.5 收尾（PRD §13）会修复测试挂载，让根目录 `npm test` 能直接跑全部 50 个用例。

测试覆盖：
- ✅ `predict.ts` — 21 测试（周期均值、置信度、阶段判定、异常检测）
- ✅ `db.ts` — 10 测试（CRUD、upsert、KV）
- ✅ `i18n.ts` — 9 测试（双语切换、复数、插值）
- ✅ `insights.ts` — 10 测试（6 类洞察、PMS 模式）

覆盖率目标：**核心算法 ≥ 90%，UI 组件 ≥ 60%**（见 PRD §12.2）

## 🚢 部署

Lumi 部署在 **Cloudflare Pages**，主域名 **[lumi365.com](https://lumi365.com)**（备用子域：[lumi-6au.pages.dev](https://lumi-6au.pages.dev)）。

部署流程：GitHub `main` 分支推送 → GitHub Action 触发 → npm build → Cloudflare Pages 部署

详细部署配置：[DEPLOYMENT.md](./DEPLOYMENT.md)

## 🗺️ 路线图

| 版本 | 计划 | 状态 |
| --- | --- | --- |
| **V1** | 周期追踪 + 排卵预测 + 健康日记 + AI 洞察（本地） + 双语（zh-CN / en） | ✅ 已发布 |
| **V1.4** | PWA（可安装到主屏、离线）+ 主题切换（浅/深）+ **用户系统（Google OAuth + Cloudflare D1）** | ✅ 已发布 |
| **V1.5** | i18n 硬编码清理 + 编辑/删除月经与日记 UI + flow 录入 + Insights 历史聚合图 + "关于"页 + 测试脚本挂载修复 | 🔜 进行中 |
| V2 | 备孕模式（BBT 曲线）+ 加密备份 + 导入历史 + i18n 扩展（ja/ko/zh-TW） | 📋 计划 |
| V3 | 可选云同步（E2EE，用户自托管）+ 多端同步 | 💭 远期 |
| V4 | 孕期模式 + 围绝经期模式 + 医生分享 | 💭 远期 |

完整 PRD：[docs/MVP-PRD.md](./docs/MVP-PRD.md)（v1.6）

## 🤝 贡献

欢迎贡献！请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

特别欢迎：
- 🌍 新语言翻译（i18n）
- 🎨 设计建议 / UI 改进
- 🐛 Bug 报告
- 📝 文档改进
- 🧪 测试用例

## 📄 许可

[MIT](./LICENSE) — 自由使用、修改、分发。

## 🙏 致谢

- 设计灵感来自 [Clue](https://helloclue.com) 和 [Flo](https://flo.health)
- 医学依据：ACOG 排卵期与受孕窗口指南、《妇产科学》
- 颜色命名：暖奶油 / 柔薰衣草 / 暖珊瑚

## 📮 联系方式

- GitHub Issues：<https://github.com/ruisheng2266/lumi/issues>
- 项目主页：<https://github.com/ruisheng2266/lumi>

---

> Lumi 相信：女性的身体数据应该归女性自己。