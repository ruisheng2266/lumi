# Lumi

> 温柔、私密、只属于你的女性健康追踪工具。

Lumi 是一款**本地优先**的网页应用（PWA），帮助你追踪月经周期、排卵预测、健康日记，并提供基于本地算法的 AI 洞察。

## ✨ 核心理念

- 🚫 **零云端**：所有数据只存在你自己的浏览器中（IndexedDB），不向任何服务器上传
- 🤖 **本地 AI**：洞察基于本地规则引擎，不调用任何外部 AI 服务
- 🌿 **温和设计**：避免焦虑制造，拥抱真实身体
- 🆓 **完全免费**：永远无广告、无追踪、无订阅墙

## 🚀 部署

主部署：[Cloudflare Pages](https://pages.cloudflare.com)
- 静态文件托管（dist/）
- 全球 CDN + 自动 HTTPS
- GitHub 集成：push → 自动部署

详见 [docs/MVP-PRD.md §11.4](docs/MVP-PRD.md#114-部署架构)

## 📚 文档

- [MVP 需求文档（v1.3）](docs/MVP-PRD.md)

## 🛠️ 开发

```bash
npm install        # 安装依赖
npm run dev        # 启动 dev server（http://localhost:5173）
npm test           # 运行单元测试
npm run build      # 生产构建
npm run preview    # 预览生产构建
```

## 🔒 隐私

Lumi V1 不会发起任何业务相关的网络请求（可通过浏览器 DevTools 的 Network 面板验证）。
CSP 设置 `connect-src 'none'`，从浏览器层面物理禁止网络请求。

---

> 本仓库目前处于 V1 早期开发阶段：PRD 已锁定、技术验证已通过、Cloudflare 部署配置已完成，页面骨架正在搭建。