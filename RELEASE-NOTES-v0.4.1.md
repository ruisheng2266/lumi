# Lumi v0.4.1 发布说明

> 版本：v0.4.1 ｜ 日期：2026-07-30 ｜ 状态：已提交，待推送
> 主题：**v0.4「信任加固 + 获客钩子」收尾**——特殊生理场景、不规律周期诚实预测、a11y 量化、医生 PDF 报告

## 一、本次新增（相对 v0.4.0 导入功能）

### 1. 特殊生理场景（life events）
- 新增 `lifeEvents` 数据表（Dexie v3 schema），支持 7 类事件：
  怀孕 / 流产·小产 / 分娩 / 子宫切除 / 绝经 / 开始避孕（如 IUD）/ 停止避孕。
- `predictCycle` 新增 `lifeEvents` 参数与 `getSpecialState`：
  - **孕期 / 产后（分娩后 1 年内且无后续月经）/ 绝经 / 无周期（子宫切除）** → 诚实地**不做经期预测**，Today 显示专属状态横幅（如「孕期进行中 🤰」）。
  - 避孕方式事件**不抑制**预测，仅作标记。
  - 记录仍被安全保存，阶段结束后预测自动恢复。
- Settings 新增「特殊生理场景」管理区：列表 + 添加 Sheet（类型 / 日期 / 备注）+ 删除。
- 日历在对应日期渲染事件标记（★ 图例）并写入无障碍标签。

### 2. 不规律周期诚实预测
- 复用既有 `cycleRegularity`（CV 系数）。当 ≥4 次周期且判定 `irregular` 时：
  - Today 显示**诚实横幅**：说明波动 >4 天、强调「仅供参考，非医学诊断」，并提示 PCOS / 甲状腺 / 压力等可能原因，建议就医。
  - 预测改为**区间**：基于历史最短/最长间隔给出「下次月经可能在 X ~ Y 之间」（`rangeStart`/`rangeEnd`），不再给单一虚高确定值。

### 3. a11y 量化（无障碍）
- `document.documentElement.lang` 随当前语言同步（中/英切换时屏幕阅读器正确朗读）。
- 底部导航 `<nav>` 增加 `aria-label`（主导航）。
- 全局 `:focus-visible` 焦点轮廓，键盘可达性提升。
- 日记页心情 / 精力评分按钮补 `aria-label` 与 `aria-pressed`。
- 日历日期按钮 `aria-label` 升级为描述性文本（含经期 / 排卵 / 易孕 / 预测 / 今日 / 事件状态）。

### 4. 医生 PDF 报告
- 新增 `/report` 页面（DoctorReport）：本地生成可打印健康摘要——
  基本信息、周期统计（周期数 / 规律性 / 平均周期·经期长度 / 首末次记录）、
  最近 12 次月经历史表、症状频次 Top10、平均心情·精力·睡眠、特殊生理事件、免责声明。
- Settings「数据」区新增「查看 / 打印报告」入口；`@media print` 隐藏导航与按钮，黑字白底便于「另存为 PDF」。
- 全程零网络请求，符合本地优先与隐私承诺。

## 二、技术改动
- `src/shared/db/client.ts`：LifeEvent 接口 + `lifeEventRepo` + v3 schema。
- `src/shared/lib/predict.ts`：`SpecialState`/`getSpecialState`、predictCycle 增加 `lifeEvents`/`specialState`/`rangeStart`/`rangeEnd`。
- `validation/src/predict.ts`：同步镜像（测试用副本）。
- i18n（zh-CN / en）：lifeEvent、report、today.irregular*、nav.a11yLabel。
- 新增 `src/pages/DoctorReport.tsx`、`/report` 路由；`MonthCalendar`/`Calendar`/`Today`/`Settings`/`AppShell`/`LogSheet`/`globals.css` 适配。
- 新增 predict 单测（getSpecialState 7 例 + 特殊状态抑制 + 不规律区间），全量 **87 测试通过**。

## 三、验证
- `npm test`：87/87 通过（import 26 + predict 32 + 其他 29）。
- `npm run build`：tsc + vite 构建成功（v0.4.1）。

## 四、部署
- 本地提交完成；待 `git push origin main` 触发 GitHub Actions → Cloudflare Pages 部署。
- 双部署线已改为 Direct Upload（仅 Actions 一条线），不会再有托管构建 token 报错。
