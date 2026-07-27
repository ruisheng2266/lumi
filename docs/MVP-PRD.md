# Lumi — MVP 需求文档（V1）

> 版本：v1.5  
> 日期：2026-07-24  
> 状态：待评审

---

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 产品名称 | Lumi（暂沿用前 MVP 命名） |
| 产品定位 | 本地优先的女性健康追踪应用 |
| 文档版本 | v1.0 |
| 目标版本 | Lumi V1（纯本地版） |
| 范围 | 周期追踪、排卵预测、健康日记、AI 健康建议 |

---

## 2. 背景与愿景

### 2.1 行业现状
市面上的女性健康追踪 App（Flo、Clue、经期助手等）大多存在以下问题：
- **隐私风险**：用户的生理数据上传云端，泄露事件频发；
- **订阅陷阱**：核心功能藏在付费墙后；
- **过度收集**：申请通讯录、相册、位置等不必要权限；
- **算法黑盒**：用户不知道排卵/受孕预测是怎么算出来的；
- **体验同质化**：花哨的图表堆叠，但缺乏真正的"洞察"。

### 2.2 Lumi 的愿景
> **让女性重新拥有自己的身体数据主权，温和、诚实、有帮助。**

Lumi 是一个**纯本地运行**的网页/PWA 应用：
- 数据只存在你自己的浏览器（IndexedDB），不向任何服务器上传；
- 永远免费、无广告、无追踪；
- 提供基于本地算法 + 模式识别的"AI 洞察"，透明可解释；
- 用温柔的视觉语言表达，避免性别刻板印象（粉红+花）。

---

## 3. 目标用户

### 3.1 核心用户画像

**画像 A：珊珊，26 岁，互联网产品经理**
- 月经基本规律（28~30 天），偶尔推迟；
- 想知道自己什么时候来姨妈，避免尴尬；
- 最近开始备孕，需要更准确地判断排卵期；
- 注重隐私，手机里的健康类 App 不想让另一半看到；
- 痛点：被商业 App 的推送和订阅骚扰。

**画像 B：Linda，34 岁，全职妈妈**
- 月经不规律，怀疑是压力导致的；
- 想记录症状，找到规律去看医生时能拿出数据；
- 不想用某知名 App 因为被曝过数据泄露；
- 痛点：没有简单的方式记录和导出健康日志。

**画像 C：阿 May，29 岁，自由职业者**
- 经期伴随严重 PMS，情绪波动大；
- 想了解"为什么这几天特别丧"；
- 偏好简洁、本地化的工具；
- 痛点：现有 App 给的建议都是模板化的废话。

### 3.2 用户需求分层

| 需求层级 | 描述 | V1 是否满足 |
| --- | --- | --- |
| L0 基础 | 记录月经开始/结束 | ✅ |
| L1 进阶 | 预测下次月经和排卵 | ✅ |
| L2 洞察 | 发现自己的周期规律和症状模式 | ✅ |
| L3 共情 | 根据当前阶段给出个性化建议 | ✅ |
| L4 协作 | 与伴侣/医生共享数据 | ❌ V2+ |
| L5 智能 | 自动从语气/情绪推断健康状态 | ❌ V3+ |

---

## 4. 核心价值主张

1. **数据归你**：所有数据存在本地，可一键导出/删除；
2. **完全离线**：断网也能用全部功能（V1 即 PWA 友好）；
3. **透明算法**：每个预测都附"为什么这么算"；
4. **本地 AI 洞察**：基于你自己的历史数据生成模式识别和建议，**不上传任何数据给第三方 AI**；
5. **温柔设计**：舒缓的视觉与文案，没有焦虑制造。

---

## 5. 产品范围

### 5.1 V1 In Scope（必做）

| 模块 | 功能点 | 优先级 |
| --- | --- | --- |
| 入职引导 | 首次启动收集基本信息（最近一次月经、平均周期） | P0 |
| 周期追踪 | 记录月经开始/结束、流量；历史回看；编辑 | P0 |
| 排卵预测 | 自动计算下次月经、排卵日、易孕期窗口 | P0 |
| 健康日记 | 每日记录：情绪、精力、睡眠、症状、备注 | P0 |
| AI 洞察 | 周期规律性、症状-阶段相关性、个性化建议 | P0 |
| 日历视图 | 月历叠加周期状态 | P1 |
| 数据管理 | 导出 JSON / 永久删除 | P0 |
| 隐私政策 | 离线友好的本地 README + 应用内"关于"页 | P0 |
| 国际化（i18n） | 简体中文 + English 双语；可运行时切换；预留扩展接口 | P0 |
| 主题切换 | 浅色 / 深色 / 跟随系统 | P0 |

### 5.2 V1 Out of Scope（不做）

- ❌ 云同步、账号系统、跨设备同步
- ❌ 备孕模式（BBT 曲线、同房记录）
- ❌ 孕期模式
- ❌ 围绝经期专属模式
- ❌ 推送通知 / 提醒
- ❌ 医生共享、伴侣共享
- ❌ 第三方 AI API 接入
- ❌ 药品 / 避孕药追踪
- ❌ 自动翻译 / 机器翻译集成（V1 文案必须人工本地化）
- ❌ Apple Health / Google Fit 集成

---

## 6. 核心功能详述

### 6.1 周期追踪（Cycle Tracking）

#### 6.1.1 用户故事
> 作为用户，我希望可以**快速记录一次月经的开始/结束**，并能**回看历史周期**，以便掌握自己的规律。

#### 6.1.2 功能描述
- **记录月经开始**：一键点击，日历日期可选；
- **记录月经结束**：同样支持补录；
- **流量等级**：轻 / 中 / 重（用于未来算法，不强制）；
- **历史列表**：按时间倒序显示所有周期；
- **编辑/删除**：支持修正历史数据。

#### 6.1.3 自动派生指标
| 指标 | 算法 |
| --- | --- |
| 周期长度 | 相邻两次月经"开始日"间隔天数 |
| 经期长度 | 单次月经"开始→结束"天数 |
| 平均周期长度 | 最近 6 个周期的算术平均 |
| 周期规律性 | 最近 6 个周期长度的标准差 |
| 最短 / 最长周期 | 全部周期中的极值 |

#### 6.1.4 验收标准
- ✅ 用户可以在 30 秒内完成一次"记录月经开始"；
- ✅ 系统能正确识别并合并同一个月经事件的多日记录；
- ✅ 修改历史数据后，所有派生指标（平均周期、排卵预测）即时更新；
- ✅ 当历史周期 < 2 时，显示"需要更多数据"的友好提示而非报错
- ✅ 支持编辑月经事件的开始日 / 结束日 / 流量 / 备注；
- ✅ 删除月经事件时弹出二次确认对话框，且操作不可撤销（导出的 JSON 是唯一的恢复途径）。

---

### 6.2 排卵预测（Ovulation Prediction）

#### 6.2.1 用户故事
> 作为用户，我希望知道**下一次月经大概什么时候来**、**哪几天最容易受孕**，以便提前规划生活或备孕。

#### 6.2.2 核心算法

> **Lumi 的排卵预测是"透明算法"，每个数字都有依据。**

```
已知：
- 平均周期长度 = avg_cycle_len（默认 28 天，可调）
- 黄体期长度 ≈ 14 天（生理常数，医学共识）

预测：
- 下次月经开始日 = 上次月经开始日 + avg_cycle_len
- 排卵日 = 下次月经开始日 - 14
- 易孕窗口 = [排卵日 - 5, 排卵日 + 1]（共 7 天）
- 易孕概率峰值 = 排卵日前 2 天和排卵日前 1 天
```

#### 6.2.3 置信度分级
| 数据量 | 置信度 | 文案 |
| --- | --- | --- |
| 0 个完整周期 | 无 | "需要记录至少 1 次完整月经才能预测" |
| 1 个完整周期 | 低 | "基于 1 个周期预测，准确度有限" |
| 2~3 个完整周期 | 中 | "基于 N 个周期预测" |
| ≥ 4 个周期 | 高 | "基于 N 个周期预测，置信度较高" |

#### 6.2.4 视觉呈现
- 月历视图上，**排卵日用特殊图标标记**；
- **易孕窗口用浅色背景**铺满；
- 今日页给出"今天处于周期的第 X 天（卵泡期 / 排卵期 / 黄体期 / 经期）"。

#### 6.2.5 验收标准
- ✅ 算法函数 `predictCycle(history)` 是纯函数，附带 JSDoc 与单元测试；
- ✅ 预测结果展示"基于多少数据"的说明；
- ✅ 用户可以手动调整"平均周期长度"，系统用调整值覆盖默认值。

---

### 6.3 健康日记（Health Diary）

#### 6.3.1 用户故事
> 作为用户，我希望**每天花不到 1 分钟**记录当下的身体和情绪状态，长期下来能看到自己的模式。

#### 6.3.2 字段定义

| 字段 | 类型 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| 日期 | Date | 是 | 默认今天 |
| 情绪 | 1~5 + emoji | 否 | 😢 😟 😐 🙂 😄 |
| 精力 | 1~5 | 否 | 1=疲惫 5=充沛 |
| 睡眠 | 小时（小数） | 否 | 例 7.5 |
| 症状 | 多选标签 | 否 | 见下方预设列表 |

| 备注 | 文本（500 字内） | 否 | 自由记录 |

**预设症状标签**（V1 固定，后续可自定义）：
- 😣 经痛
- 🤕 头痛
- 🎈 腹胀
- 💧 白带变化
- 🌸 乳房胀痛
- 😖 恶心
- 🍫 食欲变化
- 🌡️ 发热
- 😴 嗜睡
- 💤 失眠
- 🌺 痤疮
- 💩 便秘
- 🚽 腹泻

#### 6.3.3 交互
- **快速记录**：Today 页底部固定一个"+"按钮，点击弹出抽屉式表单；
- **历史回看**：Insights 页可按天/周/月聚合查看；
- **补录**：日历点击任意日期可补录/编辑当日记录。

#### 6.3.4 验收标准
- ✅ 一条记录最多 3 次点击即可保存（情绪 → 精力 → 保存）；
- ✅ 表单字段可全部留空（不强制填写）；
- ✅ 同一日期支持多次编辑，保留最后一次版本；
- ✅ 删除记录时弹出二次确认。

---

### 6.4 AI 健康建议（AI Health Insights）

> **重要声明**：V1 的"AI"是**本地规则引擎 + 模式识别**，不调用任何外部 AI 服务。所有数据都在浏览器内处理。

#### 6.4.1 用户故事
> 作为用户，我希望看到**关于自己身体的洞察**，而不只是看到一堆原始数据。

#### 6.4.2 洞察分类

| 类别 | 输入 | 输出（示例） |
| --- | --- | --- |
| **周期规律性** | 周期长度序列 | "近 6 个月你的周期波动在 ±2 天以内，规律性良好 ✨" |
| **PMS 模式** | 周期后 7 天 vs 其他阶段的症状对比 | "你在经前 3 天最常出现 🍫 食欲变化 和 😣 经痛" |
| **能量-阶段关联** | 精力评分 × 阶段 | "你在卵泡期精力平均 4.2/5，排卵期达到峰值 4.6/5" |
| **睡眠-情绪关联** | 睡眠时长 × 情绪评分 | "睡眠 < 6 小时的次日，你的情绪平均低 1.2 分" |
| **今日提醒** | 当前阶段 + 历史模式 | "你正处于黄体期第 5 天，过去类似阶段你常感到 🎈 腹胀，建议少食多餐" |
| **异常提示** | 与历史均值偏差 > 2σ | "本次月经提前 5 天，可能与近期压力相关" |

#### 6.4.3 实现方式（本地）

```typescript
// 伪代码
function generateInsights(userData): Insight[] {
  const insights = []
  
  // 1. 周期规律性
  if (cycles.length >= 3) {
    const cv = stddev(cycles) / mean(cycles)
    insights.push({
      type: 'regularity',
      level: cv < 0.05 ? 'good' : cv < 0.1 ? 'ok' : 'irregular',
      message: ...
    })
  }
  
  // 2. PMS 模式：统计每个症状在不同阶段出现的频率
  // 3. 能量-阶段关联：按阶段聚合精力均值
  // 4. 今日提醒：基于当前阶段和历史模式生成
  // 5. 异常检测：当前值与历史均值的偏差
  
  return insights.sortBy(severity).slice(0, 10)
}
```

#### 6.4.4 个性化文案模板
每个洞察**必须包含三部分**：
1. 📊 **数据**：具体数字
2. 💡 **解读**：这意味着什么
3. 🌿 **建议**：你可以做什么

#### 6.4.5 隐私边界
- 所有计算在 `Web Worker` 或主线程内运行；
- 不发起任何网络请求用于"AI 分析"；
- 在"关于"页明确说明："AI 洞察基于本地规则引擎，不上传任何数据"。

#### 6.4.6 验收标准
- ✅ 当用户数据 < 7 天时，显示"需要更多数据才能生成洞察"；
- ✅ 每条洞察可点击展开看到原始数据；
- ✅ 用户可以"关闭某类洞察"，偏好持久化；

### 6.5 国际化（Internationalization, i18n）

#### 6.5.1 用户故事
> 作为用户，我希望可以**用自己的母语使用 Lumi**，并能随时切换语言，以便获得更亲切的体验。

#### 6.5.2 语言支持范围

| 版本 | 支持语言 |
| --- | --- |
| **V1（必交付）** | 🇨🇳 简体中文（zh-CN，默认）<br/>🇺🇸 English（en） |
| V2（计划） | 🇯🇵 日本語（ja）<br/>🇹🇼 繁體中文（zh-TW）<br/>🇰🇷 한국어（ko） |
| V3+（远期） | 🇪🇸 Español（es）、🇫🇷 Français（fr）、🇩🇪 Deutsch（de）、🇸🇦 العربية（ar, RTL） |

> V1 的 i18n 基础设施必须设计为**可插拔**，新增语言仅需添加一个 JSON 文件，无需修改组件代码。

#### 6.5.3 技术方案

**i18n 库选型**：
eact-i18next + i18next
- 行业标准，TypeScript 友好；
- 内置浏览器语言检测、复数处理、命名空间、懒加载；
- 与 date-fns/locale 配合实现日期本地化；
- 与原生 Intl.NumberFormat 配合实现数字/单位本地化；
- Bundle 体积：~10KB gzip。

**目录结构**：

`
src/
└── shared/
    └── i18n/
        ├── index.ts          # i18next 初始化
        ├── config.ts         # 支持语言列表 + 元数据
        ├── locales/
        │   ├── zh-CN/
        │   │   ├── common.json       # 通用文案（按钮、标签）
        │   │   ├── pages.json        # 各页面文案
        │   │   ├── insights.json     # AI 洞察文案
        │   │   ├── onboarding.json   # 入职引导文案
        │   │   └── errors.json       # 错误提示
        │   └── en/
        │       └── (同上)
        └── hooks/
            └── useLocale.ts  # 读取 + 切换语言
`

**语言检测优先级**：
1. 用户在 Settings 手动选择（最高优先）；
2. localStorage 中保存的用户偏好；
3. 浏览器 
avigator.language 匹配 supported list；
4. fallback → zh-CN（因目标用户以中文为主）。

#### 6.5.4 需要翻译 vs 不翻译的内容

| 内容类型 | 示例 | 处理 |
| --- | --- | --- |
| UI 标签 / 按钮 | "记录月经" / "Log Period" | ✅ 翻译 |
| 页面标题 / 段落 | "今日" / "Today" | ✅ 翻译 |
| Toast / 错误提示 | "保存失败" / "Failed to save" | ✅ 翻译 |
| 空状态文案 | "还没有记录哦" / "No logs yet" | ✅ 翻译 |
| AI 洞察文案 | "近 6 个月你的周期规律性良好 ✨" | ✅ 翻译 |
| 周期阶段名称 | "卵泡期" / "Follicular Phase" | ✅ 翻译（医学术语表） |
| 日期 | "2026年7月24日" / "July 24, 2026" | ✅ date-fns locale |
| 数字 / 单位 | "6 个月" / "6 months" | ✅ Intl |
| **用户输入的备注** | "今天很疲惫" | ❌ 保留原文 |
| **数据 schema 字段名** | startDate | ❌ 代码标识符 |
| **emoji 表情** | 😣 🤕 🎈 | ⚠️ 跨语言一致，不翻译 |

#### 6.5.5 本地化（L10n）细节

**日期格式**（date-fns）：
- zh-CN：yyyy年M月d日 → 2026年7月24日
- en：PPP → July 24th, 2026

**数字格式**（Intl.NumberFormat）：
- zh-CN：1,234.5
- en-US：1,234.5（差异在更高数量级时显现：10,0000 vs 100,000）

**复数处理**（i18next 自动）：
`json
// en
"daysLogged": "{count} day logged",
"daysLogged_other": "{count} days logged"
`
`json
// zh-CN（无复数变化）
"daysLogged": "已记录 {count} 天"
`

**字符串插值示例**：
`	ypescript
t('daysLogged', { count: 5 })  // zh: "已记录 5 天"  en: "5 days logged"
t('cyclePhase', { phase: 'follicular' })  // zh: "当前处于卵泡期"  en: "You're in the follicular phase"
`

#### 6.5.6 布局适配

| 现象 | 解决方案 |
| --- | --- |
| 中文按钮常比英文短（如"取消" vs "Cancel"） | 按钮用 min-width 而非固定宽度 |
| 英文文案常更长，可能换行 | 设置 	ext-wrap: balance 或允许 2 行 |
| 中英文混排行高差异 | 行高统一设为 1.6，两端对齐 |
| 数字与单位之间空格 | zh：无；en：6 months（i18next 处理） |
| 长单词溢出（如英文 symptom 名） | 设置 overflow-wrap: anywhere |

**为 RTL 预留（V3+）**：
- 使用 margin-inline-start/end 而非 margin-left/right；
- 使用 padding-inline-* 同理；
- 切换语言时设置 <html dir="rtl|ltr">。

#### 6.5.7 语言切换交互

`
Settings → 通用 → 语言
  → 显示支持语言列表（每项：母语名 + 英文名 + 国旗 emoji）
  → 当前语言右侧显示"✓"
  → 点击其他语言 → 立即生效，无需重启
  → 偏好写入 settings 表（key: 'language'）
`

#### 6.5.8 翻译质量保证

- **不引入机器翻译**：所有文案由人工撰写或由 native speaker 校对；
- **避免字面翻译**：英文文案"本地化"而非"翻译"，符合英文用户表达习惯；
- **医学术语统一表**：

| 中文 | English |
| --- | --- |
| 月经 / 经期 | Period / Menstruation |
| 排卵 | Ovulation |
| 卵泡期 | Follicular Phase |
| 黄体期 | Luteal Phase |
| 易孕期 | Fertile Window |
| 经前综合征 (PMS) | Premenstrual Syndrome (PMS) |
| 经痛 | Menstrual Cramps / Dysmenorrhea |
| 基础体温 (BBT) | Basal Body Temperature (BBT) |

- **性别中立**：英文避免隐含性别（如不写 "she might experience..."，改用 "you might..."）；
- **长度控制**：核心按钮文案中英长度差不超过 2 倍；
- **不翻译 emoji 与数字**。

#### 6.5.9 验收标准
- ✅ Settings 可在 zh-CN / en 之间切换，无需刷新页面；
- ✅ 所有 UI 文字（按钮、Toast、错误提示、AI 洞察、空状态）均翻译完毕，无遗漏硬编码中/英文；
- ✅ 日期、数字、单位按 locale 正确格式化；
- ✅ 首次启动根据浏览器语言自动选择 zh-CN 或 en；
- ✅ 用户语言偏好持久化，关闭浏览器后再次打开保持；
- ✅ 切换语言不影响已录入的用户数据（数据 schema 与语言无关）；
- ✅ 导出 JSON 中语言偏好作为 metadata 字段保存（meta.language）；
- ✅ 新增一种语言仅需：(1) 添加 JSON 文件 (2) 在 config.ts 注册，无需改组件代码。

---
---

## 7. 数据模型（Dexie / IndexedDB）

```typescript
// 数据库 schema（LumiDB v1）
{
  periods: '++id, startDate, endDate, createdAt',
  dailyLogs: '++id, date, createdAt, [date+date]',
  settings: 'key',
  insightPrefs: 'key',
}
```

### 7.1 periods（月经事件）
```typescript
interface Period {
  id?: number;
  startDate: string;     // ISO date 'YYYY-MM-DD'
  endDate?: string;      // 未结束则为空
  flow?: 'light' | 'medium' | 'heavy';
  notes?: string;
  createdAt: number;
  updatedAt: number;
}
```

### 7.2 dailyLogs（每日日志）
```typescript
interface DailyLog {
  id?: number;
  date: string;          // ISO date 'YYYY-MM-DD'（唯一）
  mood?: 1 | 2 | 3 | 4 | 5;
  energy?: 1 | 2 | 3 | 4 | 5;
  sleepHours?: number;
  symptoms?: string[];   // 标签 ID 数组
  notes?: string;
  createdAt: number;
  updatedAt: number;
}
```

### 7.3 settings（设置，KV 存储）
```typescript
interface Setting<T = any> {
  key: string;
  value: T;
}

// V1 内置 key：
// - 'language': 'zh-CN' | 'en'（用户语言偏好）
// - 'theme': 'light' | 'dark' | 'system'（主题）
// - 'onboarded': boolean（是否完成入职引导）
// 注：avgCycleLen / avgPeriodLen / displayName 已迁移至 user_profile 表（§7.4）

// V1 内置 key：
// - 'language': 'zh-CN' | 'en'（用户语言偏好）
// - 'theme': 'light' | 'dark' | 'system'（主题）
// - 'avgCycleLen': number（用户自定义平均周期长度，默认 28）
// - 'onboarded': boolean（是否完成入职引导）
```

---



### 7.4 user_profile（用户档案，独立表）

```typescript
interface UserProfile {
  id?: number;
  displayName?: string;       // 用户昵称（最长 30 字，可选）
  avgCycleLen: number;        // 平均周期长度（21~45），默认 28
  avgPeriodLen: number;       // 平均经期长度（2~10），默认 5
  createdAt: number;
  updatedAt: number;
}
```

**说明**：
- 该表只有 1 条记录（`id` 固定为 1，upsert 模式）；
- `avgCycleLen` 与 §6.1.3 算法计算的"实际均值"是**两个独立来源**：
  - 算法计算的均值：基于历史数据；
  - 用户设置的均值：基于自我认知 / 历史经验；
- 排卵预测**优先使用本表"用户设置值"**，仅在缺失时 fallback 到计算值；
- 未来扩展：生日（年龄段分析）、身高体重（BMI）等。

### 7.5 数据库版本与迁移

- Dexie schema 版本固定为 `v1`；
- 任何破坏性 schema 变更必须写 `.version(N).upgrade(tx => ...)` 迁移函数；
- 老用户升级时自动执行迁移，数据不丢失；
- 导出 JSON 顶层包含 `schemaVersion` 字段，导入时校验兼容性。

---
## 8. 用户流程

### 8.1 首次启动
```
启动 → 检测浏览器语言 → 若 zh* 默认 zh-CN，否则 en → 显示入职引导（3 步）
  → Step 1: 语言选择（首次可切换，预填上面推断的语言）+ 可选昵称（合并到一页）
  → Step 2: 最近一次月经开始日（默认今天/日历选）
  → Step 3: 平均周期长度（默认 28，可调 21~45）+ 平均经期长度（默认 5，可调 2~10）
  → 进入主界面（Today）

> 备注：Step 3 新增『平均经期长度』字段（PRD v1.2 评审通过），用于更准确预测经期持续天数。
```

### 8.2 记录一次月经
```
Today → 看到"今天是否来月经？"卡片 → 点击"是的，开始记录"
  → 弹出记录表单（自动定位到今天）
  → 一键保存 → 返回 Today，看到"经期第 1 天"
```

### 8.3 记录健康日记
```
Today → 底部"+"按钮 → 抽屉弹出
  → 选择情绪 emoji（1 次点击）
  → 选择精力（1 次点击）
  → 多选症状（可选）
  → 写备注（可选）
  → 保存
```

### 8.4 查看 AI 洞察
```
底部导航 → Insights
  → 顶部：当前周期阶段卡片
  → 中部：今日提醒（基于阶段）
  → 下部：模式洞察列表（按优先级排序）
  → 每条洞察可展开看数据
```

### 8.5 导出数据
```
Settings → 数据管理 → 导出
  → 生成 JSON 文件（含 periods / dailyLogs / settings）
  → 浏览器下载
```

---

## 9. 非功能需求

### 9.1 隐私 & 安全
- ✅ **零网络请求**：应用初始化后所有功能离线可用；
- ✅ **零追踪**：无 GA / Sentry / 任何分析 SDK；
- ✅ **数据导出**：支持 JSON 导出，格式自描述；
- ✅ **数据删除**：Settings 一键"永久删除所有数据"，二次确认；
- ✅ **清晰说明**：About 页说明存储位置（IndexedDB）、如何清除。

### 9.2 性能
| 操作 | 目标耗时 |
| --- | --- |
| 冷启动到可交互 | < 2s（本地） |
| 记录一次月经 | < 500ms |
| 切换页面 | < 200ms |
| 生成 AI 洞察 | < 1s |
| 日历渲染 | < 300ms |

### 9.3 可访问性
- ✅ 颜色对比度满足 WCAG 2.1 AA；
- ✅ 所有交互可键盘操作；
- ✅ 表单字段都有 label；
- ✅ 不依赖颜色单独传达信息（用图标+文字）。

### 9.4 兼容性
- ✅ Chrome / Edge / Safari / Firefox 最新两个大版本；
- ✅ iOS Safari 14+ / Android Chrome 90+；
- ✅ 移动端断点 375 / 768 / 1024。

### 9.5 国际化（i18n）
- ✅ **双语支持**：V1 必须 100% 完成 zh-CN 和 en 翻译，无遗漏硬编码文案；
- ✅ **运行时切换**：切换语言不刷新页面，所有 UI 即时更新；
- ✅ **locale 感知**：日期、数字、单位按当前 locale 格式化；
- ✅ **数据无关**：数据 schema 与语言无关，切换语言不丢数据；
- ✅ **持久化**：语言偏好写入 IndexedDB，跨会话保持；
- ✅ **可扩展性**：新增语言仅需 JSON 文件 + config 注册，不改组件；
- ✅ **导出兼容**：导出 JSON 中 meta.language 字段记录用户偏好；
- ✅ **离线可用**：所有翻译文案打包进 bundle，无需网络下载。

---

## 10. UI/UX 原则

### 10.1 视觉语言
- **主色**：暖奶油 `#FAF7F2`、柔薰衣草 `#C8B6E2`、暖珊瑚 `#E8B4A0`；
- **辅助色**：墨黑 `#2D2A26`、雾灰 `#8B8680`；
- **字体**：系统字体栈；
  - zh-CN：-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif；
  - en：-apple-system, "Inter", "Segoe UI", sans-serif；
  - 数字与日期统一使用等宽数字（ont-variant-numeric: tabular-nums），防止切换时跳动；
- **圆角**：12px / 16px / 24px 分级；
- **阴影**：极简，单层 0 4px 16px rgba(0,0,0,0.06)；
- **图标**：lucide-react，统一 stroke-width 1.75。

### 10.2 交互原则
1. **永远不焦虑制造**：文案避免"危险/警告/异常"，用"留意/观察/可能相关"；
2. **永远不催促**：没有"立即登录/立即分享"按钮；
3. **永远不隐藏数据**：所有派生指标可点击查看原始数据；
4. **永远可逆**：每个破坏性操作都有二次确认；
5. **温柔但诚实**：预测会注明置信度，不做虚假承诺。

### 10.3 文案风格
| 场景 | ❌ 不要 | ✅ 推荐 |
| --- | --- | --- |
| 数据不足 | "错误：周期数据不足" | "再多记录 1~2 次月经，预测会更准哦" |
| 异常提醒 | "你的月经异常！" | "本次月经比平均提前了 5 天，可能与近期压力相关，建议留意" |
| AI 洞察 | "AI 判定：可能怀孕" | "基于你的数据，这段时间精力与往常不同，建议结合其他信号判断" |

---

## 11. 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                  Browser (PWA-capable)                   │
├─────────────────────────────────────────────────────────┤
│  React 18 + TypeScript                                  │
│  ├── React Router v6                                    │
│  ├── Tailwind CSS + shadcn/ui（无 Radix，仅样式参考）  │
│  └── lucide-react（图标）                              │
├─────────────────────────────────────────────────────────┤
│  应用层                                                  │
│  ├── pages/        (Onboarding, Today, Calendar, ...)   │
│  ├── components/   (UI + Feature)                       │
│  └── hooks/        (usePeriods, useInsights, ...)       │
├─────────────────────────────────────────────────────────┤
│  领域层                                                  │
│  ├── lib/cycle/    (predict.ts — 周期预测纯函数)        │
│  ├── lib/insights/ (engine.ts — AI 洞察本地引擎)        │
│  ├── lib/dates/    (date.ts — 日期工具)                 │
│  └── lib/ai/       (templates.ts — 洞察文案模板)        │
├─────────────────────────────────────────────────────────┤
│  数据层                                                  │
│  ├── shared/db/    (Dexie schema + repos)               │
│  └── IndexedDB     (浏览器本地存储)                      │
└─────────────────────────────────────────────────────────┘
```

### 11.1 关键依赖
| 包 | 用途 |
| --- | --- |
| `react`, `react-dom` | UI 框架 |
| `react-router-dom` | 路由 |
| `typescript`, `vite` | 工程化 |
| `tailwindcss`, `postcss`, `autoprefixer` | 样式 |
| `dexie`, `dexie-react-hooks` | IndexedDB |
| `date-fns` | 日期处理 |
| `lucide-react` | 图标 |
| `clsx`, `tailwind-merge` | className 合并 |
| `zustand` | 轻量全局状态（主题、用户偏好） |



### 11.4 部署架构

#### 11.4.1 平台选型

**主部署**：[Cloudflare Pages](https://pages.cloudflare.com)

| 维度 | 说明 |
| --- | --- |
| 类型 | 纯静态文件托管 |
| 构建产物 | `dist/`（Vite 标准输出） |
| 域名 | V1 用 `*.cloudflarepages.com` 子域名；未来可绑自定义 |
| 成本 | 免费（无限请求、无限带宽） |
| CDN | 全球 300+ 边缘节点 |
| HTTPS | 自动签发 + 自动续期 |
| 部署方式 | GitHub 集成：push → 自动构建部署 |

**备选**（未来考虑）：
- 国内镜像：阿里云 OSS / 腾讯云 COS（应对国内访问 GFW 问题）
- P2P 镜像：IPFS（去中心化分发）

#### 11.4.2 安全头（`_headers`）

部署时强制设置以下 HTTP 头：

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; worker-src 'self' blob:; manifest-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=(), usb=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

| 头 | 作用 |
| --- | --- |
| `Content-Security-Policy: connect-src 'none'` | **物理禁止**任何 fetch/XHR/WebSocket，固化"零网络"承诺 |
| `X-Frame-Options: DENY` | 防止被 iframe 嵌入点击劫持 |
| `Referrer-Policy: no-referrer` | 不发送来源信息 |
| `Permissions-Policy` | 禁用定位、相机、麦克风等权限 |

#### 11.4.3 SPA 路由（`_redirects`）

```
/*    /index.html   200
```

处理 React Router 的客户端路由（`/today`、`/calendar` 等非根路径刷新不报 404）。

#### 11.4.4 缓存策略

| 资源 | Cache-Control |
| --- | --- |
| `index.html` | `no-cache, no-store, must-revalidate` |
| `/assets/*`（带 hash） | `public, max-age=31536000, immutable` |
| `/favicon.svg`、`/manifest.json` | `public, max-age=86400` |

#### 11.4.5 自动化部署（CI/CD）

- GitHub Action：`.github/workflows/deploy.yml`
- 触发：`push` 到 `main` 分支
- 步骤：install → build → deploy via Wrangler
- 凭据：`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`（GitHub Secrets）

#### 11.4.6 部署清单（DoD）

- [ ] Cloudflare Pages 项目创建，绑定 GitHub `ruisheng2266/lumi`
- [ ] 构建设置：Build command = `npm run build`，Output = `dist`
- [ ] 自定义域名绑定（未来）
- [ ] Cloudflare Analytics 关闭（隐私）
- [ ] GitHub Secrets 注入 `CLOUDFLARE_API_TOKEN`
- [ ] 首次自动部署成功后，手动 push 一次测试

---
### 11.2 工程结构
```
src/
├── main.tsx                  # 入口
├── App.tsx                   # 根组件 + 路由
├── styles/globals.css        # Tailwind + 全局样式
├── app/
│   └── AppShell.tsx          # 应用外壳（导航 + 布局）
├── pages/
│   ├── Onboarding.tsx
│   ├── Today.tsx
│   ├── Calendar.tsx
│   ├── LogSheet.tsx
│   ├── Insights.tsx
│   ├── Settings.tsx
│   └── About.tsx
├── shared/
│   ├── db/
│   │   ├── client.ts         # Dexie 实例
│   │   ├── schema.ts         # 表定义
│   │   └── repositories.ts   # CRUD 封装
│   ├── lib/
│   │   ├── cn.ts
│   │   ├── date.ts
│   │   ├── id.ts
│   │   ├── predict.ts        # 周期预测算法
│   │   ├── insights.ts       # 洞察引擎
│   │   └── insights.tpl.ts   # 洞察文案模板
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Chip.tsx
│       ├── IconButton.tsx
│       └── Sheet.tsx
└── types/
    └── index.ts
```

---


### 11.5 用户系统架构（V1.4 新增）

#### 11.5.1 架构

```
浏览器 → /auth/login (Pages Function)
        → Google OAuth 2.0
        → /auth/callback (Pages Function)
        → Cloudflare D1 (用户身份)
        → Set-Cookie session=...
        → 重定向到 /

+--------------------+
|  Cloudflare Pages  |
|  +--------------+   |
|  |  Static App  |   |  ← React SPA + IndexedDB (健康数据)
|  |  + Functions |   |  ← Pages Functions (身份验证)
|  +--------------+   |
|         |          |
|  +------v------+   |
|  |  D1 (users) |   |  ← 身份数据
|  |  D1 (sess.)  |   |
|  +-------------+   |
+--------------------+
```

#### 11.5.2 数据分布

| 数据 | 位置 | 上传？ |
| --- | --- | --- |
| 月经记录、症状、备注 | IndexedDB | ❌ |
| 用户 profile | Cloudflare D1 | ✅ |
| 会话 token | HTTP-only Cookie | ✅ |

**核心原则：健康数据永远不离开浏览器。**

#### 11.5.3 端点

| 端点 | 方法 | 功能 |
| --- | --- | --- |
| `/auth/login` | GET | 跳转到 Google OAuth |
| `/auth/callback` | GET | 处理回调，存用户，创建 session |
| `/auth/logout` | GET/POST | 清除 session |
| `/auth/me` | GET | 返回当前用户（JSON） |

#### 11.5.4 安全措施

- ✅ HTTP-only + Secure + SameSite=Lax Cookie
- ✅ CSRF 保护（state 参数）
- ✅ Session 30 天过期
- ✅ CSP 限制仅允许 Google 域

#### 11.5.5 数据库 Schema

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  picture TEXT,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```
## 12. 验收标准（Definition of Done）

### 12.1 功能完整
- [ ] 入职引导可走完 4 步并写入设置；
- [ ] 可记录、编辑、删除月经事件；
- [ ] 可记录、编辑、删除每日日志；
- [ ] 日历视图显示过去、当前、预测的周期状态；
- [ ] Today 页显示当前阶段 + 距下次月经天数；
- [ ] Insights 页根据数据量返回相应洞察；
- [ ] Settings 支持导出 JSON 和清空数据；
- [ ] **i18n**：可在 Settings 切换 zh-CN / en，无需刷新；所有 UI 文案 100% 翻译完毕；首次启动自动检测浏览器语言。

### 12.2 质量
- [ ] 关键算法（`predict.ts`, `insights.ts`）有单元测试；
- [ ] Lighthouse Performance ≥ 90，Accessibility ≥ 95；
- [ ] TypeScript 严格模式无 error；
- [ ] 控制台无 warning（React key、a11y 等）。

### 12.3 隐私
- [ ] DevTools Network 面板验证：操作全程零网络请求；
- [ ] About 页明确说明数据存储位置和清理方式；
- [ ] 导出 JSON 可在另一台设备导入恢复。

---

## 13. 路线图

| 版本 | 时间 | 关键功能 |
| --- | --- | --- |
| **V1（MVP）** | 当前 | 周期追踪 + 排卵预测 + 健康日记 + AI 洞察（本地） + **i18n（zh-CN/en）** |
| V1.1 | V1 后 2 周 | PWA（可安装到主屏、离线） + 主题切换 + i18n 完善（en 文案 native 校对） |
| V2 | V1 后 6 周 | 备孕模式（BBT 曲线）+ 加密备份 + 导入历史数据 + **i18n 扩展（ja/ko/zh-TW）** |
| V2 | V1 后 6 周 | 备孕模式（BBT 曲线）+ 加密备份 + 导入历史数据 |
| V3 | V2 后 8 周 | 可选云同步（E2EE，用户自托管） + 多端同步 |
| V4 | 未来 | 孕期模式 + 围绝经期模式 + 医生分享 |

---

## 14. 风险与权衡

| 风险 | 影响 | 缓解措施 |
| --- | --- | --- |
| 用户不输入历史数据 | 预测不准 | 入职引导默认填充合理值；空状态给出明确指引 |
| 仅依赖平均周期长度，忽略个体差异 | 排卵日偏差 | 文案明确"估算值"，置信度分级 |
| IndexedDB 被用户清空 | 数据丢失 | 主动提示定期导出；可选 PWA 持久化提示 |
| 误把"健康追踪"当"医学诊断" | 法律/伦理风险 | 全局 Disclaimer；洞察文案避免诊断口吻 |
| "AI"过度营销被质疑 | 信任危机 | 透明说明"本地规则引擎"，附"为什么这么算" |
| 浏览器 IndexedDB 限制（Safari 隐私模式） | 功能异常 | 检测并提示用户切出隐私模式 |
| 翻译质量参差影响体验 | 用户不信任 | 关键文案必须 native speaker 校对；建立术语表 |
| 中英文案长度差异导致 UI 错位 | 视觉不一致 | 按钮 min-width，文字 	ext-wrap: balance，预留 2x 长度空间 |
| 未来新增 RTL 语言（ar/he）需重构布局 | 改造成本 | 当前已用 margin-inline-* 而非 margin-left/right |
| 文案散落各组件难统一管理 | 维护困难 | 强制使用 i18n key，CI 检查无硬编码中英文 |

---

## 15. 附录

### 15.1 术语表
| 术语 | 定义 |
| --- | --- |
| 周期 | 从一次月经第一天到下次月经第一天的间隔 |
| 黄体期 | 排卵后到下次月经的阶段，通常固定 14 天 |
| 卵泡期 | 月经开始到排卵的阶段，长度可变 |
| 易孕窗口 | 受孕概率较高的时间段，通常排卵前 5 天到排卵后 1 天 |
| PMS | 经前综合征（Premenstrual Syndrome） |

### 15.2 参考资料
- 《妇产科学》第九版，人民卫生出版社
- ACOG 排卵期与受孕窗口指南
- WHO 女性生殖健康指标

### 15.3 变更日志
| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v1.0 | 2026-07-24 | 初稿 |
| v1.1 | 2026-07-24 | 新增 §6.5 国际化（i18n）：V1 支持 zh-CN + en 双语，预留扩展接口；更新 §5 范围、§7.3 设置项、§8.1 入职流程、§9.5 非功能需求、§11.1 依赖、§12.1 验收、§13 路线图 |
| v1.2 | 2026-07-24 | 评审通过：移除 V1 导入功能；主题升 P0；入职从 5 步压成 3 步（新增平均经期长度）；周期范围 21~45；移除 BBT 字段；新增 §7.4 user_profile 表 + §7.5 数据库迁移规范；增加测试覆盖率目标和 recharts / testing-library 依赖 |
| v1.3 | 2026-07-24 | 新增 §11.4 部署架构：确认 Cloudflare Pages 为主部署平台；定义 CSP（connect-src 'none'）/ _headers / _redirects / 缓存策略 / GitHub Action CI；明确隐私边界 |

---

> **评审检查清单**  
> - [ ] 目标用户与场景是否准确？  
> - [ ] 四大功能优先级是否合理？  
> - [ ] 数据模型是否覆盖所有需求？  
> - [ ] 隐私策略是否足够？  
> - [ ] UI/UX 原则是否传达清晰？  
> - [ ] 验收标准是否可测试？  
> - [ ] 风险是否充分识别？

