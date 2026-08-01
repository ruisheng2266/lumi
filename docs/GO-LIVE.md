# Lumi 上线 Checklist（沙箱 → 生产）

> 文档版本：v1.0
> 日期：2026-08-01
> 适用：将 Lumi Plus 的 PayPal 支付从 **sandbox** 切到 **live**（真实收款）
> 前提：Phase 2（E2EE 同步）与 Phase 3（Plus 权益 + 支付）已在 **PayPal 沙箱** 全链路真机验证通过（见 `docs/V1.0-ACCOUNT-SYSTEM-DESIGN.md` §8 验收标准）。当前线上 `PAYPAL_MODE=sandbox`，不会真实扣款。

---

## 0. 上线前自检

- [ ] v0.6.0 已发布且部署成功（GitHub Actions 绿、Cloudflare Pages 可访问）
- [ ] 迁移 `0004_billing.sql` 已在生产 D1 应用（`subscriptions` + `activation_codes` 表存在）
- [ ] 沙箱闭环已真机走通：订阅 → approve → webhook `BILLING.SUBSCRIPTION.ACTIVATED` → entitlement 变 plus
- [ ] 已决定正式价格（国内 ¥ / 海外 $）与币种，定价与 `docs/PRICING-STRATEGY.md` 一致
- [ ] 已有一个可公开访问的生产域名（如 `lumi365.com`），PayPal 才能把 webhook 打回

---

## 1. PayPal 切换到 Live

> 沙箱里建好的 App / Plan / Webhook **不能**直接用于生产，必须在 Live 模式重新建一套。

### 1.1 创建 Live App
1. 打开 [PayPal Developer Dashboard](https://developer.paypal.com)
2. 右上角模式切换到 **Live**（不是 Sandbox）
3. **Apps & Credentials → Create App** → 名称 `lumi` → 创建
4. 记下 **Live Client ID** 与点击 **Generate Secret** 拿到的 **Client Secret**
5. 确认 App 已开启 **Subscriptions**、**Payment links and buttons**、**JavaScript SDK v6**（功能开关与沙箱一致）

### 1.2 创建 Live Product + Plan
1. 调用 REST API（或商家后台）创建 Product：
   - `POST /v1/catalogs/products`（mode=live，用 Live Client ID/Secret 取 token）
2. 基于 Product 创建 **年付 Plan**：
   - `POST /v1/billing/plans`
   - 价格：沿用定价文档（海外 **$19.99/年**，USD）；如需改价/币种在此调整
   - `billing_cycles`：`interval_unit=YEAR, interval_count=1`，`pricing_scheme.fixed_price.value` 填金额
   - `status=ACTIVE`
3. 记下 **Live Plan ID**（以 `P-` 开头）

> 可复用沙箱建 Plan 的脚本思路（`CURL -u client_id:secret` 取 token → 建 product → 建 plan），仅把 token 端点与 API host 保持 `https://api.paypal.com`（去掉 `/sandbox`）。

### 1.3 创建 Live Webhook
1. **APIs & SDKs → Webhooks → Create Webhook**（Live 模式）
2. **Webhook URL**：`https://<你的生产域名>/api/billing/webhook`（如 `https://lumi365.com/api/billing/webhook`）
3. **订阅事件**（与 `functions/api/billing/webhook.ts` 处理对齐）：
   - `PAYMENT.CAPTURE.COMPLETED`（Founder 一次性付款完成）
   - `BILLING.SUBSCRIPTION.ACTIVATED`（Plus 订阅激活）
   - `BILLING.SUBSCRIPTION.CANCELLED`（Plus 订阅取消）
   - （可选）`BILLING.SUBSCRIPTION.SUSPENDED`、`PAYMENT.SUBSCRIPTION.PAYMENT.FAILED`
4. 记下 **Live Webhook ID**（以 `WH-` 开头）

---

## 2. Cloudflare 配置更新

路径：**Cloudflare Dashboard → Workers & Pages → `lumi` → Settings → Environment variables**（Production 环境）

将以下 Secret 更新为 **Live** 值（全部为加密 Secret）：

| 变量名 | 沙箱值（参考，勿再用） | 上线值 |
|---|---|---|
| `PAYPAL_CLIENT_ID` | 沙箱 Client ID | **Live** Client ID |
| `PAYPAL_CLIENT_SECRET` | 沙箱 Client Secret | **Live** Client Secret |
| `PAYPAL_PLUS_PLAN_ID` | `P-95N33517HH960184ENJXAG2I`（沙箱） | **Live** Plan ID |
| `PAYPAL_WEBHOOK_ID` | `0A218640NP7504352`（沙箱） | **Live** Webhook ID |
| `ADMIN_CODE` | 旧的（建议换） | **新的强随机值**（保护 `/api/admin/gen-codes`）|

> ⚠️ `PAYPAL_MODE` **不在此列表**——它是写在 `wrangler.toml` 里的编译期变量（见 §3），必须改文件并重新部署才生效。

---

## 3. 代码改动与部署

1. 编辑 `wrangler.toml`：
   ```toml
   [vars]
   PAYPAL_MODE = "live"   # 原为 "sandbox"
   ```
2. 本地提交 + 推送到 `main`：
   ```bash
   git add wrangler.toml
   git commit -m "chore: switch PAYPAL_MODE to live for production"
   git push origin main --tags
   ```
3. GitHub Actions 自动：构建 → `wrangler d1 migrations apply`（0004 已存在则幂等）→ 部署到 Cloudflare Pages。
4. 部署完成后，**强烈建议手动重跑一次 Deploy**（Actions → Run workflow）以确保 Functions 运行时读到最新 Secret + `PAYPAL_MODE`。

---

## 4. 生产闭环验证

- [ ] 用真实 PayPal 个人账号（或在 Live 下新建一个测试买家）走一遍：Settings → Plus → 订阅 Plus → 跳转 PayPal → 批准付款
- [ ] 检查 `/api/entitlement` 返回 `plan: "plus"`、`expiresAt` 为一年后的日期
- [ ] PlusPanel 显示「已激活 Plus」+ 到期时间
- [ ] 查 D1 `subscriptions` 表确认写入 `plan=plus`、`provider=paypal`、`provider_sub_id` 为订阅 ID
- [ ] 用 PayPal 后台的 **Webhook Simulator**（Live）或真实事件，确认 `BILLING.SUBSCRIPTION.ACTIVATED` 被收到且幂等（重复投递不重复开通）
- [ ] （可选）验证 Founder 一次性购买（`create-order` → `capture-order` → `PAYMENT.CAPTURE.COMPLETED` → `plan=founder`）
- [ ] 验证激活码兑换（`/api/redeem`）仍可用（不依赖 PayPal）
- [ ] **真实扣款确认**：首次 live 交易后到 PayPal 账户余额/对账单确认实际收款金额与币种正确

---

## 5. 回滚方案

| 症状 | 排查 | 回滚/缓解 |
|---|---|---|
| 部署后 `/api/billing/*` 返回 503 | `PAYPAL_*` Secret 未生效或 `PAYPAL_MODE` 未随部署更新 | 确认 Secret 已加 + 重跑 Deploy；503 不影响免费功能（红线：不阻断 Free）|
| webhook 收不到事件 | Webhook URL 不可达 / `PAYPAL_WEBHOOK_ID` 填错 / 域名 DNS 未生效 | 用 PayPal 后台 **Webhook Simulator** 发测试；核对 ID 与 URL；`webhook.ts` 验签失败会返回 400，PayPal 会重试 |
| 支付成功但 entitlement 不变 plus | `provider_sub_id` 不匹配 / 事件类型未处理 / D1 写入异常 | 查 D1 `subscriptions` 表；`webhook.ts` 日志；手动对应用户补写（临时）；修复后依赖 webhook 重试幂等 |
| 误扣款或价格错误 | Plan 金额填错 | 在 PayPal 后台修正 Plan 价格（新建 Plan 并更新 `PAYPAL_PLUS_PLAN_ID` + 重部署）|
| 紧急止血 | 任何无法快速修复的支付问题 | 将 `PAYPAL_MODE` 改回 `sandbox`（或临时停止推广 Plus 入口），免费功能不受影响 |

> 核心保障：**PayPal 相关故障绝不波及 Free 层**。任何 `PAYPAL_*` 未配置/异常时，`/api/billing/*` 返回 503，Plus UI 显示错误提示，v0.5 全部本地功能照常可用。

---

## 6. 安全与合规注意

- ❌ **绝不在 git 提交、聊天、文档里写入 live Client Secret / ADMIN_CODE 明文**。本文件仅记录标识符（Plan/Webhook ID），不记录密钥。
- ✅ `ADMIN_CODE` 上线前务必换成新的强随机值（`python3 -c "import secrets; print(secrets.token_hex(16))"`）。
- ✅ 上线后监控首笔真实交易：金额、币种、是否重复计费（webhook 幂等）。
- ✅ 保留「日落承诺」条款（`docs/PRICING-STRATEGY.md`）：停服前提前通知、开源同步服务或发纯本地终版、按剩余时长退款。
- ✅ 国内档（¥）与海外档（$）的地区分流逻辑若未实现，先以单一币种（USD）上线，避免误向国内用户展示美元价。

---

## 7. 附录：沙箱 / 生产 配置对照

| 项 | 沙箱（当前） | 生产（目标） |
|---|---|---|
| API host | `https://api.sandbox.paypal.com` | `https://api.paypal.com` |
| `PAYPAL_MODE` | `sandbox` | `live` |
| Client ID / Secret | 沙箱 App | Live App |
| Plan ID | `P-95N33517HH960184ENJXAG2I` | 新建 Live Plan |
| Webhook ID | `0A218640NP7504352` | 新建 Live Webhook |
| 真实扣款 | ❌ 不会 | ✅ 会 |
