# Lumi 打赏（Donation）功能设计文档

> 状态：已确认方案，实现中（2026-08-03）
> 关联：定价策略 `docs/PRICING-STRATEGY.md`、账号与付费设计 `docs/V1.0-ACCOUNT-SYSTEM-DESIGN.md`
> 建议归属：Roadmap v0.8（在 v1.0 付费体系稳定后叠加，纯加法、不碰红线）

---

## 1. 背景与目标

Lumi 的核心承诺是「本地优先、隐私优先、核心功能永久免费」。但独立开发需要持续投入，一部分用户也确实有「愿意支持但不想要强制付费墙」的诉求。

打赏（自愿捐赠）恰好与现有定价红线**完全兼容**：

- **纯自愿**：不解锁任何功能、不挡体验、不弹窗、不 Nagware。
- **补缝隙**：免费用户想表达支持有出口；又不会动摇「核心健康功能永不付费墙」的承诺。
- **全球可触达**：海外用已上线的 PayPal Live 集成，国内用微信/支付宝个人收款码（零后端成本）。

目标：**面向所有用户**（含未登录、纯本地用户）提供一个相对明显但克制的支持入口。

---

## 2. 渠道选型（已定）

| 渠道 | 覆盖 | 实现成本 | 决策 |
|------|------|----------|------|
| **PayPal Donate**（一次性订单，USD） | 海外用户 | 复用现有 Live 集成，新增 2 个端点 | ✅ 采用 |
| **微信 / 支付宝赞赏码**（静态图片） | 国内用户 | 纯前端展示图片，零后端 | ✅ 采用 |
| 第三方聚合（Ko-fi / 爱发电 / Buy Me a Coffee） | 全球 | 最低 | ❌ 否决：流量与品牌引向第三方，数据出走，不符隐私优先调性 |

> 注：PayPal 复用现有 Orders API 创建一次性订单，与 founder 购买同源。打赏不写任何 entitlement。

---

## 3. 用户可见流程

### 3.1 海外（PayPal）
1. 设置页「支持 Lumi」区块 → 选金额档位（$0.5 / $1 / $3 / $5 或自定义，USD，**不设定上限**）。
2. 点「捐赠」→ 前端 `POST /api/billing/create-donation` → 拿 `approveUrl` 新标签页打开 PayPal。
3. 用户在 PayPal 完成支付 → 回到设置页点「我已完成支付」→ 前端 `POST /api/billing/capture-donation` 完成捕获。
4. 捕获成功后本地写入「💜 已支持」标记（localStorage，不解锁功能）。
5. **不写任何 entitlement**（plan 不变，不解锁功能），webhook 收到事件也跳过。

### 3.2 国内（微信 / 支付宝）
1. 设置页「支持 Lumi」区块 → 点「微信」或「支付宝」。
2. 弹出 Sheet 展示对应收款码占位图 + 文案（"金额您定，建议 ¥6 / ¥18 / ¥30"）。
3. 用户扫码自行输入金额完成打赏 → 点「我已完成打赏」写入本地「💜 已支持」标记。
4. **纯前端**，无后端请求、无登录要求。

两条路径都**不需要登录**，契合「面向所有用户」。

---

## 4. 入口 UI 设计

**位置**：设置页 `<PlusPanel />` 之后插入 `<DonatePanel />`（相对明显、常驻区块，未登录也可见；非弹窗、无红点强提醒）。

**视觉**：带 ☕ 图标的小卡片，温暖、不施压的文案；若本地已有「💜 已支持」标记，标题旁显示角标。

**草稿（中文）**：
```
☕ 支持 Lumi  💜已支持（若本地已标记）

喜欢 Lumi？请我喝杯咖啡 ☕
Lumi 永久免费、无广告、不追踪。若它对你有帮助，
欢迎自愿打赏支持持续开发——不打赏也完全不影响使用。

[ 海外 · PayPal ]   选金额 $0.5 $1 $3 $5 [自定义]  [ 捐赠 ]
[ 国内 · 微信 / 支付宝 ]  [ 微信 ]  [ 支付宝 ]

小字：打赏是自愿支持，不等于购买 Lumi Plus，不获得任何额外功能。
```

**关键文案边界**（必须写入，避免模糊红线）：
- 打赏 ≠ 购买 Plus，不解锁任何功能。
- 不打赏也完全不影响使用。

---

## 5. 技术实现

### 5.1 后端（新增 2 个端点）

#### `POST /api/billing/create-donation`
- 复用 `functions/utils/paypal.ts` 的 `createOrder`。
- 请求体：`{ amountUsd: string }`（前端传，海外档位/自定义）。
- **金额校验**：仅基础格式校验——必须为正数、≤2 位小数、>0。**不设定业务上限**（产品决策：允许用户自选任意金额；实际扣款由用户在 PayPal 本人确认）。
- `custom_id` 用前缀标记：**`donation:<anonUuid>`**（`anonUuid` 随机生成，不关联用户/健康数据，仅用于 webhook 区分与防越权捕获）。
- 返回：`{ orderId, approveUrl }`。
- `return_url`：`${publicUrl}/settings?donation=return`。
- **不预写任何 subscription**。

#### `POST /api/billing/capture-donation`
- **新增独立端点**（不复用 `capture-order`，因其要求登录且写 founder）。
- 不要求登录（匿名）。
- 读 `{ orderId }` → `getOrder` 校验 `custom_id` **以 `donation:` 开头**（否则 403 防越权捕获他人订单）→ `captureOrder`。
- **不写任何 subscription / entitlement**，仅返回 `{ ok: true }`。

### 5.2 webhook 区分 donation（关键避险）
- 现有 `PAYMENT.CAPTURE.COMPLETED` 会写 `plan=founder`（永久）。
- `extractCustomId` 后若以 `donation:` 开头 → **跳过 entitlement 写入**，仅 `console` 记录，避免打赏被误判为「创始终身」。
- 这是本功能最关键的坑。

### 5.3 国内赞赏码（纯前端）
- 占位图放 `public/donate/wechat.svg` + `public/donate/alipay.svg`（同源，`img-src 'self'` 已放行，见 `public/_headers`）。
- 设置页点击 → 弹出 `Sheet`（复用现有 `Sheet` 组件）展示图片 + 文案。
- 不依赖任何后端、不读 IndexedDB、不联网（除同源图片加载）。
- 后续替换真实 PNG 时改 `DonatePanel` 内引用路径即可。

### 5.4 捐赠记录（已决：匿名聚合统计，v0.7.2 起）
- **不记录任何个人身份**（无 user_id / 姓名 / 邮箱 / 与具体人关联），但 webhook 收到 donation 的 `PAYMENT.CAPTURE.COMPLETED` 时写入一行**匿名聚合**记录到 `donations_aggregate(currency, amount, amount_usd, ts)`，仅供 owner 通过 ADMIN_CODE 看板查看总览。
- 决策演变：v0.7.1 初版为「完全不记录」（webhook 仅跳过不落库）；v0.7.2 应需求改为「匿名聚合统计」——Lumi 后端仍零 PII，但能统计累计金额/笔数/趋势。前端普通用户无任何展示。
- 仅覆盖海外 PayPal 捐赠路径；国内微信/支付宝扫码直接进个人账户、Lumi 后端无事件，无法统计（只能在你自己的微信/支付宝 App 看）。
- 本地「💜 已支持」标记仍存于用户浏览器 localStorage，与后端聚合无关。

### 5.5 i18n 新增 key
在 `src/shared/i18n/locales/zh-CN.ts` 与 `en.ts` 新增 `donate` 段（与 `about` / `plus` 并列），含金额档位文案（$0.5/$1/$3/$5、¥6/¥18/¥30）、本地标记角标、扫码提示等。

---

## 6. 金额档位（已决）

| 区域 | 预设档位 | 币种 | 自选 |
|------|----------|------|------|
| 海外（PayPal） | $0.5 / $1 / $3 / $5 | USD | ✅ 自定义，不设定上限 |
| 国内（赞赏码） | 建议 ¥6 / ¥18 / ¥30（文案引导，扫码后自定） | RMB | ✅ 用户自输，不设定上限 |

---

## 7. 与定价红线的边界（强制）

- ✅ 打赏不解锁任何功能、不替代 Plus、不消除任何限制。
- ✅ 不打赏 = 完全不影响使用。
- ✅ 不弹窗、不 Nagware、不红点强提醒。
- ✅ 不强制登录。
- ✅ 本地「💜 已支持」标记仅展示，明确不解锁任何功能。
- ❌ 绝不在打赏文案里暗示「打赏可获得 Plus / 去广告 / 解锁功能」。
- ❌ 绝不为打赏做「支持者专属功能」。

---

## 8. 隐私与合规

- 打赏全程匿名：`custom_id` 为随机 uuid，不关联账号或健康数据；仅 PayPal 路径会写一行**匿名聚合**记录（currency/amount/ts，无身份）供 owner 看板统计，不写入任何个人/周期信息。
- 国内赞赏码纯图片，无网络请求（除同源图片加载）。
- 不自动开发票；如需收据，提供联系邮箱人工处理。
- 打赏收入属个人所得，由运营方自行申报，App 内不承担税务逻辑。

---

## 9. 风险与对策

| 风险 | 对策 |
|------|------|
| 打赏被 webhook 误判为 founder 永久档 | `donation:` 前缀区分，webhook 跳过 entitlement 写入（见 5.2） |
| 越权捕获他人订单 | `capture-donation` 校验订单 `custom_id` 以 `donation:` 开头才捕获 |
| 金额被恶意放大 | 按产品决策不限制用户金额，仅基础格式校验；实际扣款由用户在 PayPal 本人确认 |
| 赞赏码图片被替换/篡改 | 同源 `public/` 托管，CSP `img-src 'self'` 限制 |
| 汇率/双币种混乱 | PayPal 收 USD、国内收 RMB，两套完全独立，不混算 |
| 模糊「免费」承诺 | 强制文案边界（见 §7），UI 评审时核对 |

---

## 10. 实现任务清单

1. [x] 文档：方案与四项决策固化
2. [ ] 后端：`create-donation` 端点（动态金额 + `donation:` 前缀 + 格式校验）
3. [ ] 后端：`capture-donation` 端点（匿名 + `donation:` 前缀校验 + 不写 plan）
4. [ ] 后端：`webhook.ts` 区分 donation，跳过 entitlement 写入（含单测）
5. [ ] 前端：`DonatePanel` 组件（金额选择 + PayPal 跳转 + 本地💜标记 + 国内 Sheet）
6. [ ] 前端：设置页 `<PlusPanel />` 之后接入 `DonatePanel`
7. [ ] i18n：`donate` 段双语文案
8. [ ] 资产：占位 SVG 收款码 → `public/donate/`
9. [ ] 测试：`create-donation` + `capture-donation` + webhook donation 不写 plan 单测
10. [ ] 构建 + 提交 + 部署（GitHub Actions）

---

## 11. 验收标准

- [ ] 未登录（纯本地）用户也能完成 PayPal 打赏。
- [ ] 打赏完成后 `plan` 仍为 `free`，不解锁任何功能。
- [ ] webhook 收到 donation 事件后 D1 无新增 founder/plus 行。
- [ ] 国内用户能看到微信/支付宝收款码并正常加载（无 CSP 拦截）。
- [ ] 打赏成功后设置页显示本地「💜 已支持」标记。
- [ ] 文案明确区分「打赏 ≠ Plus」。
- [ ] `tsc` + `vite build` + 单测全绿。

---

## 12. 已决开放问题（2026-08-03 确认）

1. **捐赠记录**：✅ **匿名聚合统计**（v0.7.2 起；原 v0.7.1 为「完全不记录」）。后端只写 `donations_aggregate`（currency/amount/ts，无身份），供 ADMIN_CODE 看板统计；前端普通用户不展示。零 PII。
2. **赞赏码资产**：✅ **先用占位图上线**，后续替换真实收款码（改 `DonatePanel` 引用路径）。
3. **本地「已支持」标记**：✅ 打赏成功后本地留无害「💜 已支持」小标记（localStorage，明确不解锁功能）。
4. **金额档位**：✅ 海外 $0.5/$1/$3/$5 + 自定义（无上限）；国内建议 ¥6/¥18/¥30（扫码自定，无上限）。
