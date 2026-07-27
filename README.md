# Lumi

> 温柔、私密、只属于你的女性健康追踪工具。

Lumi 是一款**本地优先**的网页应用（PWA），帮助你追踪月经周期、排卵预测、健康日记，并提供基于本地算法的 AI 洞察。

**🌐 在线访问**：<https://lumi365.com>（备用：<https://lumi-6au.pages.dev>）

---

## ✨ 核心理念

- 🚫 **零云端** — 所有数据只存在你自己的浏览器中（IndexedDB），不向任何服务器上传
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

## 🔐 用户系统（可选）
## 🎨 主题切换（V1.4）

Lumi V1.4 支持浅色 / 深色模式：

- 设置 → 主题（浅色 / 深色两选一）
- 选择持久化到 IndexedDB
- 颜色用 CSS 变量定义，切换无闪烁
- dark class 加在 html 元素上

## 📱 PWA（V1.4）

Lumi V1.4 支持安装到桌面 / 主屏：

- public/manifest.webmanifest 含名称、图标、shortcuts
- public/sw.js 网络优先 + 缓存回退
- iOS / Android 可添加到主屏
- 离线后仍可访问已浏览页面

Lumi V1 支持 Google 账号登录。

- **登录方式**：Google OAuth 2.0
- **用户数据存储**：Cloudflare D1（SQLite）
- **会话方式**：HTTP-only Cookie（30 天有效）
- **存储内容**：Google profile（id/email/name/picture）
- **健康数据**：仍仅在 IndexedDB（不上传）

**隐私边界**：登录后你的**身份信息**会存到 D1，但**健康数据**依然**只存在你浏览器本地**。

详细配置：参见 [DEPLOYMENT.md](./DEPLOYMENT.md) 和 [PRD §11.4](./docs/MVP-PRD.md)。

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
# 安装依赖
npm install

# 启动 dev server（http://localhost:5173）
npm run dev

# 运行单元测试
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
│   └── MVP-PRD.md           # 完整产品需求文档（v1.3）
├── public/
│   ├── _headers             # Cloudflare 安全头（含 CSP）
│   ├── _redirects           # SPA fallback
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
├── DEPLOYMENT.md            # 部署详细指南
├── CONTRIBUTING.md          # 贡献指南
├── SECURITY.md              # 安全策略
└── LICENSE                  # MIT
```

## 🔒 隐私 & 安全

Lumi V1 **不向任何服务器上传业务数据**。可通过浏览器 DevTools → Network 面板验证：操作全程零网络请求。

技术保障：
- ✅ **CSP**：`connect-src 'none'` — 物理禁止任何 fetch/XHR/WebSocket
- ✅ **HTTPS**：Cloudflare 自动签发 + 自动续期
- ✅ **HSTS**：max-age=1 年 + includeSubDomains
- ✅ **X-Frame-Options: DENY**：防点击劫持
- ✅ **Referrer-Policy: no-referrer**：不发送来源信息
- ✅ **Permissions-Policy**：禁用所有设备权限
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

无需修改组件代码。

文案规范：
- 避免性别刻板印象
- 医学术语使用统一术语表（见 PRD §6.5.8）
- 长度控制：核心按钮中英长度差不超过 2 倍

## 🧪 测试

```bash
# 在 validation/ 目录下
cd validation
npm install
npm test           # 运行全部 50 测试
npm run test:watch # 监听模式
```

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
| **V1** | 周期追踪 + 排卵预测 + 健康日记 + AI 洞察（本地） + 双语 | ✅ 已发布 |
| V1.1 | PWA（可安装到主屏、离线）+ 主题切换 + i18n 完善 | 📋 计划中 |
| V2 | 备孕模式（BBT 曲线）+ 加密备份 + 导入历史 + i18n 扩展（ja/ko/zh-TW） | 📋 计划中 |
| V3 | 可选云同步（E2EE，用户自托管） | 💭 远期 |

完整 PRD：[docs/MVP-PRD.md](./docs/MVP-PRD.md)

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