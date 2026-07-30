# Lumi v0.4.2 发布说明

> 日期：2026-07-30
> 对应 tag：`v0.4.2`
> 定位：v0.4 收尾——真·PDF 一键导出 + WCAG 2.1 AA 对比度达标 + 自动无障碍审计

## 新增功能

### 1. 真·PDF 一键导出（医生报告）
- `DoctorReport` 新增「下载 PDF」按钮，调用 `src/shared/lib/pdf.ts`：用 `html2canvas` 将报告
  DOM 栅格化、再用 `jsPDF` 嵌入 **A4 多页 PDF** 并直接触发下载（文件名 `lumi-doctor-report-YYYY-MM-DD.pdf`）。
- 选择栅格化而非纯文本排版，是为了**不塞入数 MB 中文字体**即可正确渲染中文并保留样式。
- `jspdf` / `html2canvas` 通过**动态 import** 加载，已代码分割为独立 chunk，不拖慢 PWA 首屏。
- 原「打印 / 保存为 PDF」按钮保留（走浏览器打印框），两者并存。
- 全程本地完成，无任何网络请求。

## a11y（无障碍）

### 2. 自动无障碍审计（axe-core）
- 新增 `src/test/a11y.test.tsx`：在 vitest/jsdom 中对 Today / Insights / Settings / Calendar / Log /
  DoctorReport 六个主页面跑 axe-core，断言**结构性违规为零**（标签、ARIA、标题层级、landmark 等）。
- 修复审计发现的真实问题：
  - **Settings** 隐藏的 `<input type="file">` 缺 `aria-label` → 补 `aria-label`。
  - **CardTitle** 原为 `<h3>`，在 `h1` 主标题下跳过 `h2` → 改为 `<h2>`，消除 `heading-order` 违规。

### 3. WCAG 2.1 AA 对比度达标（浅色模式，手工核算）
> 沙箱无 Chrome，无法跑 Lighthouse；以下为按 WCAG 公式对关键文字色对的手算结果，均已达标。

- **fog** `#8B8680` → `#6F6A64`：在 cream / 白 / lavender-50 上由 ≈3.37:1 提升至 **≥5.0:1**。
- **danger** `#C57070` → `#B05858`：白字由 ≈3.55:1 提升至 **4.9:1**。
- **lavender-500** `#8E73BF` → `#7A5CA8`：文字在白底由 ≈3.93:1 提升至 **5.3:1**。
- **coral-500** `#C57759` → `#A85F47`：图形/大字（标记、统计数字）达 **≥3:1**（非文本对比）。
- **按钮背景固定为深紫/深珊瑚**（lavender-600 `#6F58A0` / coral-600 `#A8573F` + coral-700 hover）：
  白字在**浅色与深色主题下均 ≥4.9:1**（原浅薰衣草/浅珊瑚底白字仅 ≈1.87:1，严重不达标）。
- **焦点轮廓**由浅薰衣草改为 `#6F58A0`（在白底 5.9:1、深底 3.0:1，满足 2.4.11 焦点外观 3:1）。
- **精力药丸**选中态文字由 coral-600 改为墨色（在浅珊瑚底上 ≈7.8:1）。

## 依赖变更
- 新增：`jspdf`、`html2canvas`、`axe-core`（仅测试/dev）。

## 已知遗留（非阻塞）
- **深色模式**：部分 `text-lavender-500` 文字在深底上约 3.3:1（小字不达标），需后续对比度 pass。
- **Lighthouse Accessibility** 无法在沙箱实测（无 Chrome），结构性 a11y 已由 axe 门禁覆盖；
  建议在浏览器/CI 跑一次 Lighthouse 复核分数（目标 ≥95）。

## 验证
- `npm test`：**95 测试全绿**（含 6 个 axe 审计 + 2 个 PDF 导出单测）。
- `tsc -b --noEmit` 通过；`npm run build` 成功（jspdf/html2canvas 已代码分割）。

## 计划变更
- **移除** deepseek 嵌套 JSON 格式适配器计划（用户决定不做，详见项目记忆）。
