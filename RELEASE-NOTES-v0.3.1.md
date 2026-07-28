# Lumi V0.3.1 — PRD 审计缺口修复 + i18n 稳定性修复

发布日期：2026-07-29

## 简介

在 V0.2.0（V1.4 账号系统 + V1.5 收尾）基础上，本版本补齐 PRD 评审中发现的 10 项缺口（V0.3.0），并修复了 V0.3.0 引入的一处 i18n 回归（V0.3.1）。所有用户可见中文均经 i18n 翻译；`npm test` 50/50 通过；生产构建干净。

## ✨ V0.3.0：PRD 审计缺口修复（10 项）

- **#1 版本号统一**：新增 `src/shared/version.ts`，由 `vite.config.ts` 注入 `package.json` 的 version，About / Settings / 导出 JSON 不再写死旧版本。
- **#2 PWA 图标**：生成 `public/icons/icon-192.png` / `icon-512.png`（薰衣草→珊瑚渐变 + 白心）；manifest 图标类型改为 `any maskable`。
- **#3 洞察分类开关**：`client.ts` 新增 `insightPrefs` 表（Dexie v2）+ 仓储；Insights 页可按分类过滤并持久化。
- **#4 系统主题**：Settings 支持浅 / 深 / **跟随系统**三选项；Onboarding 补主题选择。
- **#5 PMS 本地化**：`insights.ts` 的 PMS 模式洞察改用 `t('symptoms.${id}')` 翻译症状名。
- **#6 排卵日标记**：月历为排卵日加独立 `✸`，与易孕窗 `≈` 区分。
- **#7 预测经期可视化**：日历为预测下次经期区间着色并加图例。
- **#8 置信度分级**：Today 按 none / low / medium 显示分级文案。
- **#9 洞察折叠**：Insights 卡片解读 + 建议可展开 / 收起。
- **#10 i18n 文件化**：`config.ts` 内联 `resources` 拆分为 `src/shared/i18n/locales/zh-CN.ts` / `en.ts`。

## 🐞 V0.3.1：i18n 稳定性修复（hotfix）

- **根因**：V0.3.0 的 #10 文件化时，`config.ts` 的 `resources` 缺少 `translation` 包装层（i18next 期望 `resources['zh-CN'].translation`），导致页面显示原始 key（如 `template.today.menstrual.title`）。
- **修复**：
  - `config.ts` 的 `resources` 正确包 `translation` 层：`{ 'zh-CN': { translation: zhCN }, en: { translation: en } }`。
  - 移除 `index.ts` 的 `nsSeparator` 歧义；`template` 移入 `insight` 命名空间。
  - `sw.js` 缓存更名 `lumi-v2` 并跳过 `/src`、`/@` 路径，避免旧 bundle 被缓存。
  - `insights.ts` 改用内联症状名 fallback，移除对 `resources` 的直接依赖。
- 构建 ✅、50 测试 ✅。

## 📊 数据

| 维度 | 数值 |
|---|---|
| 版本 | v0.3.0（审计）+ v0.3.1（hotfix） |
| 文件变更（v0.3.1） | 8（config / index / locales / sw.js / insights / version / package.json） |
| 测试覆盖 | 50 / 50 通过 |
| 主 bundle | 152 KB gzip |

## 📦 部署说明

- 通过 GitHub Actions（`.github/workflows/deploy.yml`）→ `cloudflare/wrangler-action` → `wrangler pages deploy` 自动部署。
- ⚠️ 已知坑：若 Cloudflare Pages 项目用 Dashboard「Connect to Git」创建，会额外产生一条 Cloudflare 托管构建；其 build token 失效时会报 `The build token selected for this build has been deleted or rolled`。该报错**不影响** GitHub Actions 的 wrangler 部署（线上仍正常更新）。推荐把项目改为 **Direct Upload**，仅保留 Actions 部署。详见 `DEPLOYMENT.md`。

## 🙏 致谢

设计灵感来自 [Clue](https://helloclue.com) 和 [Flo](https://flo.health)；医学依据参考 ACOG 排卵期与受孕窗口指南、《妇产科学》。
