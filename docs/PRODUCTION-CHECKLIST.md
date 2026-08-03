# Lumi 生产验证 Checklist

> 用途：逐项勾选，验证完一项打一个 ✅。对应详细背景见 `PRODUCTION-VERIFICATION.md`。
> 目标：A/B/C/F/G 全绿 → Plus 付费闭环生产可用；D/E 绿 → Founder/激活码无回归。
> 红线：任一失败时，优先保证 Free 层可用，再查 `GO-LIVE.md` §5 回滚。

---

## 0. 前置（准备测试账号）
- [ ] 准备一个**全新的 PayPal 个人账号**（不同于你自己的 Founder 账号），避免覆盖本地 `founder` 行、避免误扣自己款
- [ ] 该账号绑定可小额扣款的卡/余额（年付 $19.99、月付首月 $0 试用）
- [ ] 设备已登录 Lumi，可打开 Settings → Plus 面板
- [ ] 部署已生效：`approveUrl` host 应为 `www.paypal.com`（仍是 `sandbox.paypal.com` 说明未生效，需等 CI 绿/重部署）

---

## A. 年付 Plus 端到端（#75 核心）
- [ ] Plus 面板点「订阅 Plus（年付）」→ 跳转 `www.paypal.com` 授权页
- [ ] 测试账号批准付款
- [ ] 回 App 点「刷新状态」/ 等轮询 → `/api/entitlement` 返回 `plan:"plus"`、`expiresAt≈now+1y`、`billingCycle:"annual"`
- [ ] D1 `subscriptions` 落库：`plan=plus`、`provider=paypal`、`provider_sub_id=<订阅ID>`、`billing_cycle='annual'`
- [ ] PlusPanel 显示「已激活 Plus · 年付」+ 到期时间

## B. 月付 Plus 端到端（含 7 天试用）
- [ ] Plus 面板点「订阅 Plus（月付）」→ 批准
- [ ] **试用即生效**：`ACTIVATED` 后 `plan` 立即变 `plus`（不要求首笔扣款）
- [ ] D1 落库：`billing_cycle='monthly'`、`expires_at≈now+1month`
- [ ] 对账单：首月 $0（试用），次月起每月 $2.99

## C. Webhook 幂等复验
- [ ] PayPal 后台 Webhook Simulator（Live）对 `BILLING.SUBSCRIPTION.ACTIVATED` 重复投递 2–3 次（同一 `resource.id`）
- [ ] 结果：只落一行 `plus`、不重复开通、不重复计费；`getSyncEntitlement` 幂等返回 `plan=plus`
- [ ] `CANCELLED` 重复投递：不重复过期、不误伤 founder 行（`provider_sub_id` 不匹配则跳过）

## D. Founder 一次性购买（可选）
- [ ] 走 PayPal 一次性捐赠档 → 付款 → 确认 webhook 走 `donation:` 前缀、跳过 entitlement、不误判 founder
- [ ] （更干净）走激活码兑换验证 founder：`plan=founder`、`expires_at=null`

## E. 激活码兑换真机验证
- [ ] admin 端点 `/api/admin/gen-codes`（需 `ADMIN_CODE`）生成一批码
- [ ] App 内 `/api/redeem` 兑换一个 → `plan=founder`、`provider='code'`、`expires_at=null`
- [ ] 兑换后本地 Plus 解锁、关于页/Plus 面板显示「创始终身」

## F. 真实扣款与对账单
- [ ] 首次 live 交易后查 PayPal 余额/对账单：金额（$19.99 年付 / $0 首月月付）、币种（USD）、收款方为 Live App 正确
- [ ] 确认无重复扣款（结合 C 幂等结论）

## G. 取消回落（避免自动续费）
- [ ] 验证完若不持有，立即在 PayPal 取消订阅 → 等 `BILLING.SUBSCRIPTION.CANCELLED` → `plan` 回落 `free`
- [ ] 确认来年不自动扣 $19.99 / 月不自动续 $2.99

---

## H. 非阻塞 / 业务决策（不写代码，待拍板）
- [ ] Apple 登录激活（暂缓）：需加入 Apple Developer Program $99/年 + 配 4 条 secret，再取消注释按钮
- [ ] Phase 4 伴侣共享 + AI 洞察：尚未实现，见 `V1.0-ACCOUNT-SYSTEM-DESIGN.md`
- [ ] 国内 ¥ 真实扣款：Plus 仍走 PayPal USD，见 `PRICING-STRATEGY.md` §7

---

## 验证通过标准
- [ ] A、B、C、F、G 全勾 → Plus 付费闭环**生产可用**，可对外推广
- [ ] D、E 勾选 → Founder/激活码路径无回归
- [ ] 任一失败 → 查 `GO-LIVE.md` §5 回滚，优先保 Free 层（红线）
