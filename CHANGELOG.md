# Changelog

Lumi 版本发布记录（逆向时间序）。早期版本（v0.2.0–v0.5.0）见 `docs/ROADMAP.md` 与 `docs/MVP-PRD.md`。

---

## [未发布] 生产闭环真机验证（待办）

- PayPal 已切 Live（`PAYPAL_MODE=live`，2026-08-03 提交 `3abc8d0` 部署），真实扣款已开启。
- **真实付款验证延后**：待使用另一全新账号走一遍 Plus 订阅（规避本机 `founder` 行被 `upsertSubscription` 覆盖、避免误扣款）。详见 `docs/GO-LIVE.md` §4 / §8。
- 待办：webhook 幂等复验、激活码兑换真机验证、可选 `ADMIN_CODE` 旋转、地区分流（国内 ¥ / 海外 $）。

---

## [2026-08-03] v0.7.1 — 打赏（Donation）入口

**新增：面向所有用户的自愿打赏入口（纯加法，不碰定价红线）**
- 设置页 `PlusPanel` 之后新增常驻「支持 Lumi」区块（`src/shared/donate/DonatePanel.tsx`），相对明显、非弹窗、未登录用户也可使用。
- 海外：PayPal 一次性捐赠，新增 `functions/api/billing/create-donation.ts` + `capture-donation.ts`（匿名、`donation:` 前缀 custom_id、金额仅基础格式校验不设定上限）；复用现有 Live 集成。
- 国内：微信/支付宝收款码占位图（`public/donate/wechat.svg` + `alipay.svg`，后续替换真实码），纯前端展示。
- **关键避险**：`functions/api/billing/webhook.ts` 对 `donation:` 前缀事件跳过 entitlement 写入，避免打赏被误判为创始终身；`capture-donation` 校验订单前缀防越权捕获。完全不记录捐赠（最隐私）。
- 打赏成功后本地写入「💜 已支持」标记（localStorage，明确不解锁功能）；文案明确"打赏 ≠ Plus"。
- i18n 双语文案（`donate` 段）；单测 6 例（create-donation / capture-donation / webhook 跳过）全绿；`tsc -b` + `vite build` 通过。
- 设计文档：`docs/DONATION.md`。

---

## [2026-08-03] PayPal 切换 Live 生产

- 提交 `3abc8d0`：`wrangler.toml` 的 `PAYPAL_MODE` 由 `sandbox` → `live`，CI 重新部署。
- Live PayPal 资源创建（host `api.paypal.com`）：
  - Product `PROD-3S662145MM834030H`
  - Plan `P-5HF36981A4341192LNJXXCIA`（年付 **$19.99 USD**，ACTIVE）
  - Webhook `2RJ173369R8705234`（URL `https://lumi365.com/api/billing/webhook`，3 事件）
- 4 个 Live Secret 已上传 Cloudflare（`PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_PLUS_PLAN_ID` / `PAYPAL_WEBHOOK_ID`）。`ADMIN_CODE` 保持原值。
- 文档同步更新：`docs/GO-LIVE.md` §8 执行记录 + `docs/ROADMAP.md` 状态（提交 `49f1271`）。
- 坑记录：git bash 下 curl 发中文 JSON body 被 PayPal 拒（`MALFORMED_REQUEST_JSON`），PayPal 资源 name/description 须用 ASCII；Live Webhook ID 格式 `2RJ...`（无 `WH-` 前缀）。

---

## [2026-08-02] v0.7.0 — 匿名统计 + 本地周期提醒 + 留存看板

**核心功能（v0.7.0，提交 `d51a9a3`，tag `v0.7.0`）**
- 匿名使用统计（解决"免费无登录无法度量留存"痛点，守隐私定位）：设备级匿名 ID（localStorage）、队列 + `sendBeacon` 上报、设置可关；后端 `functions/api/analytics.ts` 写入 `analytics_events`（不登录、不存 IP、不读周期内容）；迁移 `0005_analytics.sql`。埋点 `app_open` / `period_added` / `log_added`。
- 本地周期提醒：基于 `predictCycle().nextPeriodStart` 提前 2 天、应用时 best-effort 弹 Notification（Web 无法后台精确排程，可靠定时推送留作后续）；Settings「提醒与统计」分区开关。

**留存看板（提交 `cd6c2ab`）**
- `functions/api/admin/retention.ts`：按 `install_id` 算留存（KPI + 留存曲线 + 同期群 + 事件 TOP20），`ADMIN_CODE` 保护。
- `public/retention.html` + `public/retention.js`：纯原生看板，部署后访问 `https://lumi365.com/retention.html?code=<ADMIN_CODE>`。
- `docs/RETENTION-QUERIES.md`：可直接 `wrangler d1 execute` 的查询。

**修复（提交 `4d4b277`）**
- CSP 坑：`public/_headers` 为 `script-src 'self'`（无 `unsafe-inline`），初版看板内联 `<script>` 被禁 → 拆为外部 `retention.js`。经验已记入项目长期记忆：**`public/*.html` 的 JS 必须外置**。
- 远程 D1 迁移 0005（`analytics_events` 表）通过 `wrangler d1 migrations apply --remote` 补齐，看板查询 200。

**测试**：`tsc -b` + `tsc -p tsconfig.functions.json` + `vite build` 全绿，152 测试通过。

---

## [2026-07-31] v0.6.0 — Phase 2 E2EE 同步 + Phase 3 Plus 权益/支付

**同步（Phase 2，已真机验证）**
- 对称 vault 方案：AES-GCM 256 vault 密钥 + PBKDF2 310k 包裹 + 10 个恢复码；R2 存密文 blob，D1 `sync_meta` 索引；LWW 合并 + 墓碑删除。零知识。
- 提交 `a7187b6` + `7c8f090` 重部署；线上修复 3 个 bug（invalid_encoding / NOT NULL 约束 / push 时序+错误透传）。

**Plus 权益 + 支付（Phase 3，沙箱全链路验证通过）**
- 迁移 `0004_billing.sql`（`subscriptions` + `activation_codes`）+ `GET /api/entitlement`（含**祖父条款**：Phase 2 已启用同步老用户永久免费同步）。
- PayPal 沙箱：Orders API（Founder 一次性 $29.99）、Subscriptions API（Plus 年付 $19.99）、`/api/billing/webhook` 官方 `verify-webhook-signature` 幂等写库；激活码生成（`ADMIN_CODE` 保护）/ 兑换；前端 `src/shared/plus/*` + SyncPanel 同步门控。
- 三条支付链路沙箱真机验证：Plus 订阅激活 / 取消回落 free / Founder 一次性购买（plan=founder 永久）。
- 收尾（同 tag 内）：Founder 价格统一 $29.99（`530f27d`）；PlusPanel 去重「已激活」提示 + 动态方案名（`12a27d8`）。
- 提交 `055e4e1` 打 tag `v0.6.0` 并 push 触发部署。上线步骤见 `docs/GO-LINE.md`（现 `docs/GO-LIVE.md`）。

---

## 备注

- 版本号口径：**v0.x = 纯本地功能（Free 全免费）；v1.0 = 引入后端 / 付费层（Plus）**。
- 定价红线：永不接广告、永不 Nagware 弹窗、永不移基础健康项入付费墙、永不虚假折扣、承诺终身必兑现（含日落安置）。详见 `docs/PRICING-STRATEGY.md`。
- 部署：GitHub Actions（`wrangler pages deploy`）构建部署；`wrangler d1 migrations apply --remote` 随部署自动 apply（continue-on-error）。
