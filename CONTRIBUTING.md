# CONTRIBUTING.md

> 感谢你考虑为 Lumi 做出贡献！🎉

Lumi 是一个**本地优先**的女性健康应用，最看重的是**隐私、安全、可信**。任何贡献都应该与这些价值观一致。

## 📜 行为准则

参与本项目即表示你同意：
- 尊重所有贡献者，无论背景、性别、经验
- 建设性反馈，避免人身攻击
- 关注问题本身，而非争论

## 🐛 报告 Bug

在 [GitHub Issues](https://github.com/ruisheng2266/lumi/issues) 提交 Bug 报告时请包含：

1. **清晰标题**（如：Calendar 在 Safari 上显示错位）
2. **复现步骤**（具体步骤，越详细越好）
3. **期望行为** vs **实际行为**
4. **截图/录屏**（如有 UI 问题）
5. **环境**：
   - 浏览器 + 版本
   - 操作系统
   - 应用版本（commit hash 或 release tag）
6. **隐私提醒**：不要在 Issue 中粘贴真实健康数据

## 💡 提出新功能

在提交 PR 前，请先开 Issue 讨论：
- 这个功能解决什么问题？
- 是否与 Lumi 的"本地优先"原则一致？
- 是否能保持简洁（不增加认知负担）？

## 🔧 开发设置

### 前置要求
- Node.js ≥ 20
- npm ≥ 10
- Git

### Fork & Clone

```bash
git clone https://github.com/<your-username>/lumi.git
cd lumi
npm install
```

### 启动开发服务器

```bash
npm run dev
# → http://localhost:5173
```

### 运行测试

```bash
# 全部测试（在 validation/ 目录下）
cd validation
npm install
npm test

# 监听模式（开发时推荐）
npm run test:watch
```

### 项目结构

```
src/
├── app/          # 应用外壳、路由
├── pages/        # 页面组件
├── features/     # 跨页面的功能组件
├── shared/
│   ├── db/       # Dexie 数据库 + repos
│   ├── lib/      # 纯函数（predict / insights / date）
│   ├── i18n/     # 国际化配置
│   └── ui/       # 原子组件
└── styles/       # 全局样式
```

## 📝 代码风格

### TypeScript
- ✅ 严格模式（`tsconfig.json` 中 `strict: true`）
- ✅ 显式类型，不依赖类型推断
- ✅ 函数参数和返回值类型化
- ❌ 避免 `any`（必要时用 `unknown` + 类型守卫）

### React
- ✅ 函数组件 + Hooks
- ✅ 单文件不超过 300 行（复杂组件拆分子组件）
- ✅ Props 接口用 `interface` 而非 `type`
- ✅ 业务组件放 `features/`，展示组件放 `pages/`
- ❌ 避免类组件

### 样式
- ✅ Tailwind CSS utility classes
- ✅ `cn()` 合并条件类名
- ✅ 颜色使用主题色（`lavender`、`coral`、`cream`、`ink`、`fog`）
- ❌ 避免行内 style（除非动态计算）
- ❌ 避免魔法数字（间距、字号用 Tailwind scale）

### 命名约定
- 文件：`PascalCase.tsx`（组件）、`camelCase.ts`（工具）
- 组件：`PascalCase`
- Hook：`useXxx`
- 常量：`UPPER_SNAKE_CASE`
- 函数：`camelCase`，动词开头

## 🌐 添加新语言翻译

Lumi V1 支持 zh-CN 和 en。新增语言：

1. 编辑 `src/shared/i18n/config.ts`：
   ```typescript
   export const SUPPORTED_LOCALES = ['zh-CN', 'en', 'ja'] as const;
   
   export const LOCALE_META = {
     // ...
     ja: { nativeName: '日本語', englishName: 'Japanese', flag: '🇯🇵' },
   };
   
   export const resources = {
     // ...
     ja: {
       common: { save: '保存', /* ... */ },
       // ... 完整翻译
     },
   };
   ```

2. 测试：
   ```typescript
   it('switches to Japanese', async () => {
     await i18next.changeLanguage('ja');
     expect(i18next.t('common.save')).toBe('保存');
   });
   ```

3. 翻译质量要求：
   - 不使用机器翻译
   - 医学术语参考 PRD §6.5.8 术语表
   - 核心按钮中英长度差不超过 2 倍
   - 性别中立（英文避免 she/her）

## 💬 Commit 消息约定

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型**：
- `feat` — 新功能
- `fix` — Bug 修复
- `docs` — 文档变更
- `style` — 代码格式（不影响逻辑）
- `refactor` — 重构
- `test` — 测试相关
- `chore` — 构建/工具变更
- `ci` — CI/CD 变更

**示例**：
```
feat(insights): add PMS pattern detection

Implement the algorithm that compares symptom frequency
in PMS window vs other cycle phases. Use 2-cycle isolation
to avoid historical bias.

Closes #42
```

## 🔄 Pull Request 流程

1. **从 main 创建 feature 分支**：
   ```bash
   git checkout -b feat/your-feature
   ```

2. **开发 + 测试**：
   ```bash
   # 写代码 + 测试
   npm test
   npm run type-check
   ```

3. **Commit**：
   ```bash
   git add -A
   git commit -m "feat: description"
   ```

4. **Push + 开 PR**：
   ```bash
   git push origin feat/your-feature
   ```
   然后在 GitHub 上开 Pull Request，描述：
   - 改动内容
   - 关联 Issue
   - 测试覆盖
   - 截图（如 UI 改动）

5. **Code Review**：
   - 维护者会审查代码
   - 根据反馈修改
   - CI 必须通过（tests + build + type-check）

6. **合并**：
   - Squash merge（保持线性历史）
   - 自动触发部署

## ✅ DoD（Definition of Done）

PR 合并前必须满足：

- [ ] 所有测试通过
- [ ] TypeScript 类型检查通过
- [ ] 新功能有单元测试覆盖（核心算法 ≥ 90%）
- [ ] 新文案双语齐全
- [ ] 文档更新（如适用）
- [ ] 无 console.log 残留
- [ ] 无未使用变量
- [ ] 截图/GIF（如 UI 改动）

## 🔒 报告安全问题

**请勿**在 GitHub Issues 中公开报告安全问题。

发送邮件至：<INSERT EMAIL>

我们会尽快响应（目标：48 小时内）。

详细：[SECURITY.md](./SECURITY.md)

## 📋 Issue 标签

- `bug` — 已确认的 Bug
- `enhancement` — 新功能建议
- `docs` — 文档相关
- `good first issue` — 适合新贡献者
- `help wanted` — 需要社区帮助
- `i18n` — 翻译相关
- `design` — UI/UX 相关
- `security` — 安全相关

## 🌟 贡献者

所有贡献者将在 [README.md](./README.md) 的贡献者列表中致谢（需 PR 合并）。

---

## 📚 相关资源

- [PRD](./docs/MVP-PRD.md) — 完整产品需求
- [DEPLOYMENT.md](./DEPLOYMENT.md) — 部署指南
- [SECURITY.md](./SECURITY.md) — 安全策略
- [validation/README.md](./validation/README.md) — 技术验证报告

## 📮 联系方式

- GitHub Issues：<https://github.com/ruisheng2266/lumi/issues>
- 项目主页：<https://github.com/ruisheng2266/lumi>

---

> 欢迎加入，一起打造真正尊重用户的健康工具 🌿