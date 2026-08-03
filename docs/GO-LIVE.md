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

> ✅ **本节（1.1–1.3）已于 2026-08-03 在 Live 模式执行完成**，实际创建的资源见 §8 执行记录。注意：Live Webhook ID 格式为 `2RJ...`（**无 `WH-` 前缀**），与沙箱 `WH-xxx` 不同，但 `webhook.ts` 验签用原值，格式差异不影响。

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

> **状态（2026-08-03）**：①②③ 配置已完成并部署（见 §8），**④ 真实付款验证延后**——用户决定用**另一个全新账号**测试（规避本机 `founder` 行被 `upsertSubscription` 覆盖、并避免误扣款）。以下步骤待该账号到位后执行。

- [ ] 用真实 PayPal 个人账号（或在 Live 下新建一个测试买家）走一遍：Settings → Plus → 订阅 Plus → 跳转 PayPal → 批准付款
- [ ] 检查 `/api/entitlement` 返回 `plan: "plus"`、`expiresAt` 为一年后的日期
- [ ] PlusPanel 显示「已激活 Plus」+ 到期时间
- [ ] 查 D1 `subscriptions` 表确认写入 `plan=plus`、`provider=paypal`、`provider_sub_id` 为订阅 ID
- [ ] 用 PayPal 后台的 **Webhook Simulator**（Live）或真实事件，确认 `BILLING.SUBSCRIPTION.ACTIVATED` 被收到且幂等（重复投递不重复开通）
  > **实测结论（2026-08-03 下午）**：用官方 `simulate-event` API 成功发起模拟，PayPal 真实投递带签名头的事件到 `/api/billing/webhook`（事件 `WH-7768…`），证明**端点可达 + 真实验签通过 + 事件分发正常**。但 PayPal `simulate-event` **不接受自定义 `resource`**（硬塞任意 `resource` 均返回 `MALFORMED_REQUEST_JSON`，正确用法为 `{webhook_id, event_type, resource_version}`，resource 由模板生成），模板资源**无 `custom_id`** → 本端 `webhook.ts` 正确返回 `skipped: no_custom_id` 不落库（已查 D1 确认无新行）。故 simulate-event 能验证「验签+分发」，**无法验证「落库为 plus」**——此层由本地单测补齐（见 §8「Webhook 不花钱验证」）。
- [ ] （可选）验证 Founder 一次性购买（`create-order` → `capture-order` → `PAYMENT.CAPTURE.COMPLETED` → `plan=founder`）
- [ ] 验证激活码兑换（`/api/redeem`）仍可用（不依赖 PayPal）
- [ ] **真实扣款确认**：首次 live 交易后到 PayPal 账户余额/对账单确认实际收款金额与币种正确
- [ ] **部署自检**（付款前）：点订阅后看 `approveUrl` host——`www.paypal.com`=已切 live 可付；`www.sandbox.paypal.com`=部署仍是旧 sandbox 版，需等 CI 绿/重部署
- [ ] **只验证不持有时**：激活后立即在 PayPal 取消年付订阅，等 `BILLING.SUBSCRIPTION.CANCELLED` → plan 回落 free（避免明年自动续费 $19.99）

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

| 项 | 沙箱（旧） | 生产（已生效 2026-08-03） |
|---|---|---|
| API host | `https://api.sandbox.paypal.com` | `https://api.paypal.com` |
| `PAYPAL_MODE` | `sandbox` | `live`（已写入 `wrangler.toml` 并提交部署 `3abc8d0`） |
| Client ID / Secret | 沙箱 App | **Live App**（已上传 Cloudflare Secret） |
| Product ID | （沙箱未单独建） | `PROD-3S662145MM834030H` |
| Plan ID | `P-95N33517HH960184ENJXAG2I` | `P-5HF36981A4341192LNJXXCIA`（年付 $19.99 USD, ACTIVE） |
| Webhook ID | `0A218640NP7504352` | `2RJ173369R8705234`（无 `WH-` 前缀，正常） |
| 真实扣款 | ❌ 不会 | ✅ 会 |

---

## 8. 执行记录（2026-08-03）

**已完成（上线阻塞项 ①②③）：**
1. **Live PayPal 资源创建**（host `api.paypal.com`，复用沙箱流程）：
   - Product `PROD-3S662145MM834030H`
   - Plan `P-5HF36981A4341192LNJXXCIA`（年付 $19.99 USD, `interval_unit=YEAR`）
   - Webhook `2RJ173369R8705234`（URL `https://lumi365.com/api/billing/webhook`，3 事件已绑定）
   - ⚠️ 坑：git bash 下 curl 发**中文** JSON body 被 PayPal 拒（`MALFORMED_REQUEST_JSON`）——PayPal 资源 `name`/`description` 必须用 ASCII。
2. **4 个 Live Secret 已上传**（`wrangler pages secret put --project-name=lumi`）：`PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_PLUS_PLAN_ID`(=`P-5HF36981A4341192LNJXXCIA`) / `PAYPAL_WEBHOOK_ID`(=`2RJ173369R8705234`)。`ADMIN_CODE` 保持原值未动（留存看板在用，旋转为可选后续）。
3. **`wrangler.toml` 改 `PAYPAL_MODE = "live"`** → 提交 `3abc8d0` 已 push，CI 重新部署（用新 MODE + 新 Secret）。

**延后（④ 生产验证）：**
- 用户决定用**另一全新账号**做真实付款测试（规避本机 `founder` 行被 `upsertSubscription` 覆盖成 `plus`、并避免误扣款）。当前 live 配置已就绪，新账号到位即可直接走 §4 验证。
- 代码层已确认链路正确：`create-subscription` 读 `PAYPAL_PLUS_PLAN_ID`(live) + 把 `user_id` 写入 `custom_id` 回传；`webhook.ts` 随 `PAYPAL_MODE=live` 自动切 `api.paypal.com` 验签落库；激活时 `upsertSubscription(plus)` 先 `DELETE` 旧行再 `INSERT`。

**Webhook 不花钱验证（2026-08-03 下午）：**
- 用 PayPal 官方 `simulate-event` API 发起 `BILLING.SUBSCRIPTION.ACTIVATED` 模拟，PayPal 受理并真实投递带签名头事件到 `https://lumi365.com/api/billing/webhook`（事件 ID `WH-77687562XN25889J8-8Y6T55435R66168T6`，模板订阅 `I-BW452GLLEP1G`）。验证「端点可达 + 真实验签通过 + 事件分发」三层通 ✅。
- 限制：PayPal `simulate-event` **不接受自定义 `resource`**（硬塞对象/字符串/最小字段均 `MALFORMED_REQUEST_JSON`）；正确用法 `{webhook_id, event_type, resource_version}`，resource 走模板。**模板无 `custom_id`** → 本端 `webhook.ts` 按设计 `skipped: no_custom_id` 不落库（防无主数据污染）。查 D1 `subscriptions` 表确认仅 founder 行、无新 plus 记录。
- 落库逻辑用本地单测精确补齐：`functions/api/billing/billing.test.ts` 新增 `ACTIVATED→plan=plus`（`expires_at=next_billing_time`）与 `CANCELLED→过期`（仅当 `provider_sub_id` 匹配才过期，防误伤 founder）两用例，mock `verify-webhook-signature=SUCCESS`。`npx vitest run billing` → **16/16 通过**。提交 `97ba33c` 已 push。
- 结论：**「webhook 验签 + 落库逻辑」已双重验证**（真实验签链路 + 单测精确落库）。唯一未覆盖的是「真实付款 → custom_id 由我们写入 → 指定账号落库为 plus」端到端层，需真实交易（任务 #75，等另一账号）。simulate-event 先天做不到此层。

**尚未做（可选）：**
- `ADMIN_CODE` 旋转（建议上线后换成新强随机值）。
- 地区分流（国内 ¥ / 海外 $）：当前单币种 USD 上线，符合 GO-LIVE §6 建议。
