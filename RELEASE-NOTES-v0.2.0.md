# Lumi V0.2.0 — V1.4 账号系统 + V1.5 收尾

发布日期：2026-07-28

## 简介

本次发布涵盖两个迭代：V1.4 加入可选 Google 账号系统与 PWA / 主题；V1.5 完成 i18n 硬编码清理、CRUD UI、Insights 历史聚合图、About 页、测试挂载、CI 完善。所有用户可见中文走 i18n key；`npm test` 一键 50 通过；build 干净。

## ✨ 新增功能

### V1.4：账号系统 + PWA + 主题
- 🔐 **可选 Google 账号登录**：通过 Cloudflare Pages Functions（`/auth/login|callback|logout|me`）走 OAuth 2.0，身份数据写入 D1；HTTP-only Cookie 会话（30 天）。健康数据**始终仅存本地**。
- 📱 **PWA**：manifest + service worker（network-first + cache fallback），支持安装到主屏 / 离线访问。
- 🎨 **主题切换**：浅色 / 深色两选一，CSS 变量驱动，dark class 加在 `<html>` 上。

### V1.5 收尾
- 🌐 **i18n 完备化**：13 个新命名空间（`account` / `overview` / `calendar` / `clear` / `logPage` / `periodEdit` / `logEdit` / `day` / `logList` / `confirm` / `flow` / `chart` / `about` / `template`），共 ~250 个 key × zh-CN + en 双语。所有用户可见中文硬编码清零。
- ✏️ **CRUD UI**：3 个 Sheet 组件
  - `PeriodEditSheet` — 月经记录（startDate / endDate / flow / notes）
  - `LogEditSheet` — 每日日志（mood / energy / sleep / symptoms / notes）
  - `DayDetailSheet` — 日历点击日期的统一入口
  - 删除操作走二次确认 Sheet
- 📊 **Insights 历史聚合图**：recharts 懒加载（不污染主包）
  - 趋势图：mood / energy / sleep 三选一，4 档时间范围（7/30/90/全部）
  - 症状频率条形图：仅显示计数 > 0 的症状
- 📄 **About 页**（`/about`）：版本信息 / 隐私承诺 / AI 引擎 / 数据存储 / 账号系统 / 技术栈 / 致谢 / 仓库。满足 PRD §6.4.5 / §12.1 / §12.3 全部验收。
- ✅ **测试挂载修复**：根目录 `npm test` 一键跑全部 50 用例（自动发现 `src/` + `validation/src/`）。
- 🔄 **CI 完善**：`.github/workflows/deploy.yml` 拆分 `ci` / `deploy` 两个 job；PR 自动跑 ci；deploy 仅 main 直接 push 触发；concurrency 自动取消过期 runs；build artifact 复用。

## 🛠 技术改进

- `src/shared/lib/insights.ts` 重构：导出 `TranslateFn` 类型；接受可选 `t` 参数；传入时走 i18n key，未传时回落中文（保持单测零改动）。
- `src/shared/i18n/config.ts` 扩展 ~250 个 key；`index.ts` 注册 17 个命名空间。
- 所有页面 `tsc --noEmit` 零错误；`vitest` 50 测试全通过。

## 📊 数据

| 维度 | 数值 |
|---|---|
| 文件变更 | 20（15 修改 + 5 新增） |
| 代码增量 | +2069 / -182 行 |
| 新组件 | PeriodEditSheet / LogEditSheet / DayDetailSheet / InsightsCharts / About |
| 新 i18n key | ~250 × 2 语言 |
| 测试覆盖 | 50 / 50 通过 |
| 主 bundle | 150 KB gzip |
| lazy InsightsCharts | 107 KB gzip |

## 📦 部署说明

本版本通过 GitHub Action 自动部署到 Cloudflare Pages：
- `ci` job 在每次 push / PR 触发：type-check + test + build
- `deploy` job 仅在 main 直接 push 触发：下载 ci 产物 → wrangler deploy

需配置 GitHub Secrets：
- `CLOUDFLARE_API_TOKEN`（Pages:Edit 权限）
- `CLOUDFLARE_ACCOUNT_ID`

详见 `DEPLOYMENT.md`。

## 🙏 致谢

设计灵感来自 [Clue](https://helloclue.com) 和 [Flo](https://flo.health)；医学依据参考 ACOG 排卵期与受孕窗口指南、《妇产科学》。