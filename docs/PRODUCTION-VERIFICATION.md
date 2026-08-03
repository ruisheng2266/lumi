# Lumi 生产验证清单（Go-Live Verification）

> 本文件是 **Lumi 上线后真实环境验证** 的唯一可执行清单，整合自 `GO-LIVE.md` §4 与各项决策。
> 代码与验签链路已用 PayPal `simulate-event` + 单测双重验证；本清单覆盖**唯一未被自动化覆盖的「真实付款 → 落库」端到端层**（任务 #75）及几项人工确认项。

**当前已就绪（无需再配置）**
- PayPal Live 资源：Product `PROD-3S662145MM834030H`；年付 Plan `P-5HF36981A4341192LNJXXCIA`（$19.99/年）；月付 Plan `P-3VB87838PS565850CNJYLD7I`（$2.99/月，含 7 天试用）。Webhook `2RJ173369R8705234`。
- Cloudflare Secrets：`PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_PLUS_PLAN_ID` / `PAYPAL_PLUS_PLAN_ID_MONTHLY` / `PAYPAL_WEBHOOK_ID` / `ADMIN_CODE`（已旋转）。
- `wrangler.toml`：`PAYPAL_MODE = "live"`。
- 地区分流（v0.7.5）、日落承诺文案（v0.7.6）、价格分档（v0.7.7）均已上线。

---

## 0. 前置条件
- [ ] 准备一个**全新的 PayPal 个人账号**（不同于你自己的 Founder 账号），用于测试付款。这样能规避本机 `founder` 行被 `upsertSubscription` 覆盖成 `plus`，也避免误扣你自己的款。
- [ ] 该测试账号绑定一张可小额扣款的卡/余额（年付 $19.99、月付首月 $0 试用）。
- [ ] 一台已登录 Lumi 且能打开 Settings → Plus 面板的设备。

---

## A. 年付 Plus 端到端（#75 核心）
- [ ] Settings → Plus → 点「订阅 Plus（年付）」→ 弹出 PayPal 授权页（`approveUrl` host 应为 `www.paypal.com`，若仍是 `sandbox.paypal.com` 说明部署未生效，需等 CI 绿/重部署）。
- [ ] 用测试账号批准付款。
- [ ] 回到 App，点「刷新状态」或等轮询，`/api/entitlement` 返回：
  - `plan: "plus"`
  - `expiresAt` ≈ 一年后
  - `billingCycle: "annual"`
- [ ] **预期 D1 落库**：`subscriptions` 表新增/覆盖一行 `plan=plus`、`provider=paypal`、`provider_sub_id=<订阅ID>`、`billing_cycle='annual'`、`expires_at≈now+1y`。
- [ ] PlusPanel 显示「已激活 Plus · 年付」+ 到期时间。

## B. 月付 Plus 端到端（含 7 天试用）
- [ ] Settings → Plus → 点「订阅 Plus（月付）」→ 批准。
- [ ] **试用即生效**：`ACTIVATED` 事件触发后 `plan` 立即变 `plus`（试用期内即享 Plus，不要求首笔扣款）。
- [ ] **预期 D1 落库**：`billing_cycle='monthly'`、`expires_at≈now+1month`（PayPal 试用也算首期）。
- [ ] 观察对账单：首月应为 $0（试用），次月起每月 $2.99。

## C. Webhook 幂等复验
- [ ] 在 PayPal 后台 **Webhook Simulator（Live）** 对 `BILLING.SUBSCRIPTION.ACTIVATED` 重复投递 2–3 次（同一 `resource.id`）。
- [ ] 确认：只落库一行 `plus`、不重复开通、不重复计费；`getSyncEntitlement` 幂等返回 `plan=plus`。
- [ ] `CANCELLED` 同理：重复投递不重复过期、不误伤 founder 行（`provider_sub_id` 不匹配时跳过）。

## D. Founder 一次性购买（可选）
- [ ] Settings → 支持 Lumi → PayPal 一次性捐赠档（或 `create-order` → `capture-order`）。
- [ ] 完成付款 → `PAYMENT.CAPTURE.COMPLETED` → **注意**：捐赠路径 `custom_id` 带 `donation:` 前缀，webhook 会跳过 entitlement 写入、不误判 founder。
- [ ] 若要验证 founder 权益，走**激活码兑换**（`/api/redeem`）更干净：兑换后 `plan=founder`、`expires_at=null`（永久）。

## E. 激活码兑换真机验证
- [ ] 用 admin 端点 `/api/admin/gen-codes`（需 `ADMIN_CODE`）生成一批激活码。
- [ ] 在 App 内 `/api/redeem` 兑换一个 → `plan=founder`、`provider='code'`、`expires_at=null`。
- [ ] 确认：兑换后本地 Plus 功能解锁、关于页/Plus 面板显示「创始终身」。

## F. 真实扣款与对账单
- [ ] 首次 live 交易后，到 PayPal 余额/对账单确认：金额（$19.99 年付 / $0 首月月付）、币种（USD）、收款方为你的 Live App。
- [ ] 确认无重复扣款（结合 C 的幂等结论）。

## G. 取消回落（避免自动续费）
- [ ] 验证完若不打算持有，立即在 PayPal 取消该订阅 → 等 `BILLING.SUBSCRIPTION.CANCELLED` → `plan` 回落 `free`、`syncEntitled` 视祖父条款而定。
- [ ] 确认：来年不会自动扣 $19.99 / 月不会自动续 $2.99。

---

## H. 非阻塞 / 业务决策项（不写代码，待你拍板）
- **Apple 登录激活（暂缓）**：代码已部署（v0.7.3）按钮已隐藏（v0.7.4）。启用需你加入 Apple Developer Program（$99/年）并按 `docs/APPLE-LOGIN.md` 配 Services ID + Auth Key + 4 条 `wrangler secret put`，再取消注释按钮。当前 Google 登录正常。
- **Phase 4 伴侣共享 + AI 洞察**：账号系统最后一块，尚未实现。伴侣共享需把当前「per-record LWW 合并」升级为字段级合并；AI 更深入洞察需后端或可选云。见 `V1.0-ACCOUNT-SYSTEM-DESIGN.md`。
- **国内 ¥ 真实扣款**：Plus 仍经 PayPal 以 USD 结算（界面 ¥ 为参考价）。要以 ¥ 扣款需接入微信/支付宝「委托代扣/周期扣款」产品（需商户资质），属独立工作项，见 `PRICING-STRATEGY.md` §7。

---

## 验证通过标准
- A、B、C、F、G 全部勾选 → Plus 付费闭环 **生产可用**，可对外推广。
- D、E 勾选 → Founder/激活码路径无回归。
- 任一失败 → 查 `GO-LIVE.md` §5 回滚方案，并优先保证 Free 层不受影响（红线）。
