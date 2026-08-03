# Changelog

Lumi 版本发布记录（逆向时间序）。早期版本（v0.2.0–v0.5.0）见 `docs/ROADMAP.md` 与 `docs/MVP-PRD.md`。

---

## [2026-08-03] v0.7.6 — 创始终身日落承诺落地文案

**修正 + 新增：将「创始终身」的真实范围与停运预案发布到用户可见界面**
- `src/shared/i18n/locales/{zh-CN,en}.ts`：
  - `plus.founderDesc` 由「永久解锁所有 Plus 功能」改为诚实表述——设备端功能（记录/预测/洞察/导出/离线）真终身，后端服务（同步/AI/伴侣共享）在运营期间提供并受「停运预案」保障（对齐 `PRICING-STRATEGY.md` §4.1，消除原文案对后端功能的无条件终身承诺）。
  - 新增 `plus.founderSunset`：创始终身卡片下方一行「停运预案」保障摘要 + 指向关于页。
  - 新增 `about.sunsetTitle/Body/Point1-4/Closing`：关于页「停运预案（Sunset Commitment）」区块全文（提前≥6个月通知、开源/纯本地终版、按剩余时长退款、数据可导出）。
- `src/shared/plus/PlusPanel.tsx`：Founder 卡片新增 `founderSunset` 提示行。
- `src/pages/About.tsx`：新增「停运预案」卡片（Sunset 图标），i18n 驱动、中英文。
- 关闭 ROADMAP §4 待定项「创始终身日落承诺落地文案」。
- `tsc -b --noEmit` 通过，`vitest run` **163 passed**。

---

## [2026-08-03] v0.7.5 — 打赏地区分流（国内 ¥ / 海外 $）

**新增：打赏面板按地区分流主支付方式（纯前端、隐私优先）**
- `src/shared/donate/DonatePanel.tsx`：新增 `regionFromLocale()`，依据「显示语言」推断地区（zh-* → 国内；其余 → 海外），**不做 geo-IP / 不读取 IP**，与产品隐私定位一致。
- 地区对应支付方式置顶高亮：国内 = 微信/支付宝（¥）在前，海外 = PayPal（$）在前；另一种方式始终保留在「其他支付方式」分区（虚线分隔），方便跨地区用户。
- 切换设置中的显示语言会同步改变分流结果（依赖 `useLanguage` 的响应式 locale）。
- 新增 i18n：`donate.regionDomestic` / `donate.regionOverseas` / `donate.regionAuto`（自动分流提示）/ `donate.otherMethods`（中英文）。
- 后端/支付链路无改动；`tsc -b` + `vite build` 通过，全量 `vitest run` **163 passed**。
- 关闭 ROADMAP / GO-LIVE 的「地区分流（可选）」待办项。

---

## [2026-08-03] v0.7.2 — 打赏匿名聚合统计（看板）

**新增：打赏后端匿名聚合统计（仅 PayPal 路径，零 PII）**
- 新增 `migrations/0006_donations.sql`：`donations_aggregate(currency, amount, amount_usd, ts)`，仅累计金额/笔数/时间，**不含任何用户身份**（无 user_id / 姓名 / 邮箱）。
- `functions/api/billing/webhook.ts`：收到 `donation:` 前缀的 `PAYMENT.CAPTURE.COMPLETED` 时写入一行聚合记录（独立 try/catch，DB 失败不影响 webhook 返回 200）；仍跳过 entitlement 写入。国内微信/支付宝扫码直接进个人账户、Lumi 后端无事件，故不在统计内。
- 新增 `functions/api/admin/donations.ts`（`GET /api/admin/donations`，ADMIN_CODE 保护）返回：总笔数 / 累计总额(USD) / 近30日笔数+额 / 按币种 / 按月趋势(近12月) / 最近20笔。
- 新增 `public/donations.html` + `public/donations.js` 看板（CSP 兼容：外部 JS、无内联 script），访问 `/donations.html?code=<ADMIN_CODE>`。
- 决策更新：原"完全不记录"调整为"匿名聚合统计"——Lumi 后端仍不记录任何个人身份，但 owner 可通过 ADMIN_CODE 看板查看捐赠总览。前端普通用户无任何展示。`docs/DONATION.md` 已同步更新。
- 单测 7 例（含 webhook donation 写聚合行 + 不写 subscription、非 capture 事件不写聚合）；全量 `vitest run` **163 passed**；`tsc -b` + `vite build` 通过。

---

## [2026-08-03] v0.7.4 — 隐藏 Apple 登录按钮（暂缓未启用）

**调整：设置页隐藏「用 Apple 登录」按钮**
- 用户决定暂不启用 Apple 登录（未加入 Apple Developer Program，未来上架 iOS App 时按 `docs/APPLE-LOGIN.md` 第 2–3 步配好即可重新启用）。
- `src/pages/Settings.tsx`：将 Apple 按钮整段注释（保留代码便于将来恢复），并移除未使用的 `Apple` 图标 import（避免 CI `noUnusedLocals` 报错）。Google 登录正常可用、不受影响。
- 后端 `functions/auth/apple-*` + `apple-jwt.ts` 与 `migrations/0002`（apple_id 列）保持就绪，仅前端入口隐藏。
- `tsc -b` + `vite build` 通过。

---

## [2026-08-03] v0.7.3 — Apple 登录启用（前端 + 配置就绪）

**新增：Sign in with Apple（代码层全部就绪，待 Apple 开发者凭证激活）**
- 前端：设置页「账号」区块新增「用 Apple 登录」黑色按钮（variant="apple"），点击跳转服务端端点 `/auth/apple/login`（Apple 为服务端驱动流程：服务端种 oauth_data cookie → 302 到 appleid.apple.com → 回调 `/auth/apple/callback` 验签+完成登录 → 跳回 `/settings`）。与 Google 的 SPA 流程解耦。
- 后端：`functions/auth/apple-login.ts` + `apple-callback.ts`（PKCE 校验 + code 换 token + 用 Apple JWKS 验 id_token 签名/iss/aud/exp + 兼容隐私中继邮箱与首次授权 name）+ `functions/utils/apple-jwt.ts`（WebCrypto 签发 client_secret / 验 id_token，无第三方依赖）+ 单测 3 例。**均早已写好，本次仅接入前端与环境变量**。
- 配置：`wrangler.toml [vars]` 新增公开常量 `APPLE_REDIRECT_URI`。`APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_P8` 仍为 secret，需用户用 `wrangler secret put` 配置自己的 Apple 开发者凭证后方可真实登录（详见下方「待激活」）。
- 数据层：`migrations/0002_add_apple_id.sql`（users.apple_id 列 + 唯一索引）已确认在远端 apply。
- `tsc -b` + `tsc -p tsconfig.functions.json` + `vite build` 全绿；apple 单测 3/3 通过。

**待激活（需用户操作）**：在 Apple Developer 后台创建 Services ID + 启用 Sign in with Apple + 创建 Auth Key 下载 .p8，再用 `wrangler secret put` 设 4 个 APPLE_* 密钥。未设密钥前按钮可见但点击会被 Apple 拒（client_id 缺失）。

---

## [未发布] 生产闭环真机验证（待办）

- PayPal 已切 Live（`PAYPAL_MODE=live`，2026-08-03 提交 `3abc8d0` 部署），真实扣款已开启。
- **真实付款验证延后**：待使用另一全新账号走一遍 Plus 订阅（规避本机 `founder` 行被 `upsertSubscription` 覆盖、避免误扣款）。详见 `docs/GO-LIVE.md` §4 / §8。
- 待办：webhook 幂等复验、激活码兑换真机验证（地区分流已于 v0.7.5 实现）。

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
