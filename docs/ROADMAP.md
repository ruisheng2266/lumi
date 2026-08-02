# Lumi 后续版本路线图

> 文档版本：v1.0
> 日期：2026-07-31
> 状态：v0.5.0 已发布（含导航与对比度收尾）；v1.0 Phase 1（账号 MVP / Google 登录）已上线验证（2026-07-31）；**Phase 2（E2EE 同步）与 Phase 3（Plus 权益 + 支付）已于 2026-08-01 实现 + PayPal 沙箱全链路真机验证通过**（v0.6.0）；Phase 4（伴侣共享 / AI）待做，待定项见末尾
> 关联文档：`docs/MVP-PRD.md`（PRD）、`docs/PRICING-STRATEGY.md`（定价策略）

---

## 0. 版本号对齐说明（重要）

PRD §13 沿用了内部里程碑标签（V1 / V1.4 / V1.5），与 GitHub 实际 tag **不直接对应**，容易混淆。本路线图统一改用真实 tag 编号：

| 内部里程碑（PRD 旧标签） | 实际发布 tag | 已交付内容 |
| --- | --- | --- |
| V1（MVP） | **v0.2.0** | 周期追踪 + 排卵预测 + 健康日记 + 本地 AI 洞察 + i18n（zh-CN/en） + 数据导出/清空 |
| V1.4（PWA + 主题 + 用户系统） | **v0.3.0** | PWA 图标、系统主题（浅/深/跟随）、洞察分类开关、PMS 本地化、排卵日标记、预测经期可视化、置信度分级、洞察折叠、i18n 文件化 |
| V1.5（收尾） | **v0.3.1** | i18n `translation` 包装层修复（hotfix，消除原始 key 显示） |
| v0.4 / v0.5 | **v0.4.0–v0.5.0** | 信任加固（竞品导入/特殊场景/不规律诚实预测）、a11y 实测 + 医生报告 PDF、多年趋势、围绝经期、BBT 备孕、健康科普（ja/ko/zh-TW 经用户决定移除） |

> ⚠️ **v1.0 Phase 1 账号 MVP（Google OAuth + Cloudflare D1）已于 2026-07-31 上线验证**（登录 / 登出 / 注销 / 删除后重注册全链路通过）。**Phase 2（E2EE 同步）与 Phase 3（Plus 权益 + 支付）已于 2026-07-31 实现**：同步为端到端加密跨设备同步；Plus 后端含 subscriptions/activation_codes 表、entitlement 权益计算（祖父条款保留 Phase 2 老用户免费同步）、PayPal（沙箱优先）与激活码。Phase 4（伴侣共享 / AI）仍待做。
>
> 路线图统一口径：**v0.x = 纯本地功能（Free 全免费）；v1.0 = 引入后端 / 付费层（Plus）**。

---

## 1. 当前基线（v0.3.1，已发布）

- ✅ 周期记录 / 预测 / 排卵标记 / 易孕窗
- ✅ 健康日记（情绪 / 精力 / 睡眠 / 症状 / 备注）
- ✅ 本地 AI 洞察（规律 / PMS / 能量-阶段 / 睡眠-情绪 / 今日提醒 / 异常），可分类开关
- ✅ 日历（预测经期着色、排卵 ✸、易孕窗 ≈）
- ✅ 数据导出 JSON / 永久删除
- ✅ PWA（可安装、离线）、主题（浅/深/跟随系统）
- ✅ i18n（zh-CN / en，已修复资源结构）
- ✅ 关于页、50 个单元测试、TypeScript 严格模式

---

## 2. 后续路线图

排序原则：**本地优先、后端最后；只做加法、绝不回收免费功能；版本号对齐真实 tag。**

### 🟢 v0.4 — 信任加固 + 获客钩子（全免费）
直接对冲竞品三大短板（付费墙锁基础 / 数据锁死 / 广告），且纯本地零成本。

| 功能 | 说明 | 依据 |
| --- | --- | --- |
| **① 竞品数据导入** | 支持从 Flo / Clue / 经期助手 导出文件导入（CSV/JSON）。获客最强杠杆——竞品锁死数据，Lumi 敞开导入 | 定价策略获客钩子 |
| **② 特殊生理场景** | 流产 / 分娩 / 子宫切除 / 哺乳 / 避孕方式（IUD 等）标记，并正确处理其对周期的干扰 | 竞品普遍处理差 |
| **③ 不规律周期诚实预测** | PCOS / 内异症等不规律用户：明确标注"预测置信度低"，附科普而非假装精准 | 信任 > 精准 |
| **④ a11y 量化达标** | WCAG 2.1 AA 实测；Lighthouse Accessibility ≥ 95 | PRD §12.2 验收 |
| **⑤ 医生 PDF 报告导出** | 由现有 JSON 导出增强为可读 PDF（周期/症状/趋势摘要），就诊随身带 | 用户画像 B 痛点 |

### 🟢 v0.5 — 洞察深化 + 围绝经期 + 备孕 + 科普（全免费，已交付 ✅）
> v0.5.0（2026-07-31）已完成。原计划的「i18n 扩展 ja/ko/zh-TW」经用户决定**移除**，不再纳入路线图。

| 功能 | 说明 | 依据 | 状态 |
| --- | --- | --- | --- |
| **① 本地多年趋势 & 相关性** | 周期长度长期趋势图（按年）、症状-阶段相关性堆叠图（经期/卵泡/排卵/黄体） | PRD V2 计划 | ✅ |
| **② 围绝经期专属工具** | 围绝经期状态标记（不抑制预测）+ 潮热/盗汗症状 + 专属洞察与今日提示横幅 | 竞品差异化机会 | ✅ |
| **③ 备孕模式基础（BBT）** | 日记新增基础体温录入；BBT 曲线图 + 基于"持续性升温"的排卵日推测（非诊断） | PRD V2 备孕 | ✅ |
| **④ 中立健康科普** | 应用内「健康科普」页（周期/围绝经期/备孕BBT/不规律，含免责与非诊断声明）+ 底部导航入口 | PRD §10.3 文案原则 | ✅ |

> 📌 **v0.5.0 发布后已完成的收尾（同一 tag 内，已 push）**：
> - **底部导航优化**：6 项平铺 → 高频 4 项 +「更多」弹出层（收科普/设置），移动端不再拥挤；顺手修复导航栏暗色主题跟随（原硬编码 `bg-white` 在暗色下不生效）。
> - **深色模式品牌色文字对比度修复（WCAG AA）**：根因是 Tailwind 固定深色字落在深色底仅 ~3:1；后续进一步将 `text-ink`/`text-fog` 改为引用 CSS 变量、随主题切换（浅=墨黑/雾灰、深=浅奶油/亮雾灰），并修复 danger 按钮暗色白字 2.69:1。实测深色 6.2–6.8:1、浅色 4.5–6.8:1；108 测试 + 构建通过。
> - **澄清**：此前记录的"主按钮 hover 2.95:1"实为误算，实测 5.35:1 已达标，无残留。

### 🔵 v1.0 — Plus 基础设施（付费档交付时机）
> 此刻才引入后端。Plus 上线**只做加法**，不回收任何 Free 功能（定价红线）。

| 功能 | 说明 | 层级 |
| --- | --- | --- |
| **① 账号系统落地** | ✅ 已上线：Google OAuth + Cloudflare D1，仅承载身份与偏好（SPA OAuth 流程 + PKCE + 注销 + 删除后重注册）| Plus 前置 |
| **② 端到端加密跨设备同步** | ✅ 已实现（2026-07-31）：对称 vault 方案 + R2 密文 + D1 sync_meta 索引 + 恢复码，全链路真机验证通过 | **Plus** |
| **③ 伴侣加密共享** | 授权伴侣只读/有限查看，加密共享链接 | **Plus** |
| **④ AI 洞察增强** | 可选端侧模型或可选云增强，解释"为什么"更深入 | **Plus** |
| **⑤ Plus 权益 + 支付** | ✅ 已实现 + **PayPal 沙箱真机验证通过**（2026-08-01）：subscriptions/activation_codes 表 + entitlement 权益门控（祖父条款）+ PayPal（沙箱优先：Orders/Subscriptions/webhook 幂等）+ 激活码生成/兑换 + 前端 Plus 面板与同步门控 UI | **Plus** |

> ✅ **v1.0 Phase 2（E2EE 同步）与 Phase 3（Plus 权益 + 支付）已于 2026-08-01 实现 + PayPal 沙箱全链路真机验证通过**（v0.6.0）：
> - **Phase 2**：对称 vault 方案（AES-GCM vault 密钥 + PBKDF2 包裹 + 恢复码）+ R2 存密文 blob + D1 `sync_meta` 索引 + `/api/sync` PUT/GET/DELETE（LWW）+ `/api/recovery*` 重置口令；前端 `src/shared/sync/*`（crypto/data/Zustand store/Settings 面板）。**已真机启用同步 + push/pull 全链路（修了 6 个 bug）验证通过**。
> - **Phase 3**：`migrations/0004_billing.sql`（`subscriptions` + `activation_codes`）+ `GET /api/entitlement`（权益计算含**祖父条款**：Phase 2 已启用同步的老用户永久保留免费同步，绝不回收红线）+ PayPal（沙箱优先：`PAYPAL_MODE=sandbox`；Orders API 一次性 Founder、Subscriptions API 订阅 Plus、`/api/billing/webhook` 用官方 `verify-webhook-signature` 幂等写库）+ 激活码生成（`ADMIN_CODE` 保护的管理端点）/兑换端点 + 前端 `src/shared/plus/*`（entitlement store + PlusPanel）+ SyncPanel 同步门控 UI（新免费用户看到升级引导，祖父/订阅用户照常）。**PayPal 未配置 secret 时相关端点返回 503**；`PAYPAL_*` secret 已由用户在 Cloudflare 配置、**沙箱闭环真机验证通过**（订阅 → 沙箱 approve → webhook `BILLING.SUBSCRIPTION.ACTIVATED` → entitlement 变 plus → PlusPanel 显示「已激活 Plus · 到期 2027/8/1」；取消订阅 → `CANCELLED` → entitlement 回落 free → Founder 入口重现；Founder 一次性购买 → `capture-order` → plan=founder 永久无到期）。迁移 0004 由 CI 部署自动 apply。**上线（切 live）步骤见 `docs/GO-LIVE.md`**。

> 📌 **v0.6.0 发布后已完成的收尾（同一 tag 内，已 push）**：
> - **Founder 价格统一 $29.99**：前端显示文案（zh-CN/en）本为 `$29.99`，但 `functions/utils/billing-config.ts` 下单金额误写为 `29.00`；已统一为 `29.99`（显示与真实扣款一致）。提交 `530f27d`。
> - **PlusPanel 去重「已激活」提示 + 区分方案名**：修复 Founder 激活后出现双行「已激活」的问题——删除捕获/轮询/兑换三处瞬时 `ok` 消息（与固定成功块重复），将固定块改为动态文案 `已激活 {plan} 💜`（Founder 显示「已激活 创始终身」、Plus 显示「已激活 Plus」），并移除未用的 `redeemSuccess` i18n key。提交 `12a27d8`。**152 测试 + `tsc -b` + `vite build` 全绿**。

> 📌 **v0.7.0 发布后已完成的收尾（同一 tag 内，已 push，2026-08-02）**：
> - **匿名使用统计（解决"免费无登录无法度量留存"痛点，仍守住隐私定位）**：新增 `src/shared/analytics/index.ts`（设备级匿名 ID 存 localStorage、队列 + `sendBeacon` 上报、可在设置关闭、node/jsdom 安全）、后端 `functions/api/analytics.ts`（POST 匿名写入，**不登录、不存 IP、不读周期内容**、入参校验）、迁移 `0005_analytics.sql`（`analytics_events` 表 + 索引，CI 部署自动 apply）。埋点：`app_open`（启动）+ `period_added` / `log_added`（录入组件）。可算 DAU/MAU、D1/D7/D30 留存、功能采用率，**全程零 PII**。
> - **本地周期提醒（召回主力，零服务器）**：新增 `src/shared/notifications.ts`（基于 `predictCycle.nextPeriodStart` 提前 2 天、应用时 best-effort 弹 Notification；明确 Web 无法后台精确排程，可靠定时推送留作后续 Push API 增强）+ `src/shared/ui/Switch.tsx` 开关组件 + Settings「提醒与统计」分区（通知开关 + 匿名统计开关，均尊重权限/可关）。
> - **设计原则**：两套机制都不强制登录、不碰基础健康功能付费墙、不接入广告——与定价红线一致；匿名统计明确"可随时关闭"，信任优先。
> - 提交 `d51a9a3`（16 文件 +442/-8）。**`tsc -b` + `tsc -p tsconfig.functions.json` + `vite build` 全绿，152 测试通过**。

### 🟣 v1.x+ — 生态扩展（混合层）
| 方向 | 说明 |
| --- | --- |
| 智能硬件对接 | Oura / Apple Health / Google Fit 数据导入（竞品硬件 gap） |
| 孕期模式 | 受孕后孕期追踪（PRD V4） |
| 社区 / 教育内容 | 中立健康内容平台 |
| 自托管同步 | 用户自托管 E2EE 同步服务（隐私极致选项） |

---

## 3. 与定价策略的咬合关系

| 版本 | Free 层 | Plus 层 | 变现节点 |
| --- | --- | --- | --- |
| v0.4 / v0.5 | Free 持续变厚（导入、特殊场景、围绝经期、BBT备孕、科普、a11y） | — | 零变现，积累口碑基数 |
| v1.0 | Free 不变 | Plus 靠「同步 / 共享 / AI」变现 | 国内 ¥30–58/年、海外 $19.99/年、创始终身 ¥98 |
| v1.x+ | Free 不变 | 硬件/孕期/社区 等增值 | 混合 |

**核心逻辑**：竞品因付费墙 / 广告 / 隐私翻车，Lumi 反着来——用「免费基础 + 干净无广告 + 隐私可靠」做品牌，再用真正进阶的增值（同步/共享/AI）变现。详见 `docs/PRICING-STRATEGY.md`。

---

## 4. 待定项（需拍板）

- [x] **v0.4 优先级**：① 竞品导入 vs ② 特殊场景——两者均已在 v0.4 交付（获客杠杆 + 信任加固双覆盖）
- [ ] **Plus 价格区间**：国内 ¥30–58/年 是否分档（如月度体验价）？
- [ ] **创始终身 ¥98** 的"终身"范围是否按 `PRICING-STRATEGY.md` 的日落承诺条款执行（已定，待落地文案）？
- [x] **用户系统是自建 D1 还是第三方 BaaS**？已定：自建 Cloudflare D1（非 BaaS），Phase 1 已实现并上线 ✅
- [ ] 是否接受「先发国际版（en 优先）再回国内」的节奏？
