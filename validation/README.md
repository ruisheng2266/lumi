# 技术验证报告 — Lumi V1

> 日期：2026-07-24  
> 范围：Dexie schema + i18next 接入 + predict.ts 算法  
> 结果：✅ 通过（40/40 测试）

## 目的

在正式编码前，验证 PRD §6 / §7 / §6.5 中三个最关键的技术决策：

1. **Dexie 数据模型**是否能支撑 V1 全部功能？
2. **i18next** 是否能优雅支持 zh-CN / en 双语 + 运行时切换 + 复数？
3. **predict.ts** 周期预测算法在不同场景下是否准确？

## 测试结果

```
Test Files  3 passed (3)
Tests       40 passed (40)
Duration    ~1.7s
```

### predict.ts（21 测试）

| 测试分组 | 用例数 | 覆盖场景 |
|---|---|---|
| avgCycleLen | 4 | < 2 周期、3 周期均值、剔除异常值、40 天长周期（PCOS-like） |
| cycleRegularity | 3 | 数据不足、稳定周期、波动周期 |
| phaseOf | 4 | 经期 / 卵泡期 / 排卵期 / 黄体期边界 |
| predictCycle | 7 | 空数据、低/中/高置信度、自定义均值、经期长度、阶段判定 |
| isInFertileWindow | 2 | 易孕窗口内外判定 |

### db.ts（10 测试）

| 测试分组 | 用例数 | 覆盖场景 |
|---|---|---|
| LumiDB schema | 4 | 4 张表创建、索引、CRUD |
| dailyLogRepo | 2 | 按日期 upsert（唯一性）、不存在的日期 |
| userProfileRepo | 1 | 单条记录 upsert 模式 |
| settingsRepo | 2 | 任意 KV 存取、缺失 key 返回 undefined |
| E2E | 1 | 入职 + 记录月经 + 记录日记全流程 |

### i18n.ts（9 测试）

| 测试分组 | 用例数 | 覆盖场景 |
|---|---|---|
| i18n setup | 4 | 初始化、所有 locale 注册、UI 翻译、参数插值 |
| language switching | 3 | 运行时切换 en/zh、英文复数（1 day vs 5 days） |
| locale meta | 2 | 元数据完整、国旗 emoji 非空 |

## 验证结论

### ✅ Dexie（数据层）
- 4 张表（periods / dailyLogs / userProfile / settings）创建成功
- 索引（`startDate`, `&date`, `&key`）按预期工作
- Repository 模式 CRUD 顺畅
- fake-indexeddb 在 Node 环境完美运行，浏览器内零修改即可使用

### ✅ i18next（国际化）
- 命名空间（`common`, `phases`, `insight`）注册成功
- 中文无复数、英文有复数（`_one` / `_other`），i18next 自动处理
- 参数插值用 `{var}` 语法（需配置 `prefix: '{', suffix: '}'`）
- 运行时 `changeLanguage('en')` 即时生效，无需刷新

### ✅ predict.ts（算法）
- 28 天周期：下次月经 +28 天，排卵日 = 下次月经 - 14 天
- 置信度分级正确（0 / 1 / 2~3 / ≥4 周期 → none/low/medium/high）
- 异常值剔除（< 15 或 > 60 天）正常
- 阶段判定边界正确（28 天周期下 day 13~15 为排卵期）

## 待优化项（开发阶段处理）

1. **阶段判定阈值**当前写死（5 天经期、±1 天排卵窗口），未来应支持用户自定义
2. **Dexie 迁移**当前只写 v1 schema，未来加 `.version(2).upgrade()` 流程
3. **i18n 词条**当前仅 9 个 key，覆盖首页 + 4 个阶段 + 1 个插值串；实际开发需补全

## 文件清单

```
validation/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .gitignore
├── README.md (本文件)
└── src/
    ├── setup.ts          # fake-indexeddb polyfill
    ├── predict.ts        # 周期预测算法
    ├── predict.test.ts   # 21 测试
    ├── db.ts             # Dexie schema + repositories
    ├── db.test.ts        # 10 测试
    ├── i18n.ts           # i18next 配置
    └── i18n.test.ts      # 9 测试
```

## 下一步

- ✅ PRD v1.2 已锁定
- ✅ 三大技术风险已验证通过
- 🚀 可以安全进入正式开发（初始化 Vite + React + TS 项目）