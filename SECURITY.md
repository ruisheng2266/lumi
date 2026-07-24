# SECURITY.md

> Lumi 安全策略与披露流程

## 🔒 安全承诺

Lumi 的核心原则是**用户数据归用户**：

- ✅ **零云端**：V1 所有数据存于 IndexedDB，不向任何服务器上传
- ✅ **零追踪**：无 Google Analytics / Sentry / 任何第三方 SDK
- ✅ **零 cookie**：不设置任何追踪 cookie
- ✅ **开源可审计**：所有代码开源，安全特性可见

## 🛡️ 已实施的安全措施

### 浏览器层（HTTP 头）

通过 Cloudflare `_headers` 配置：

| 头 | 值 | 作用 |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'; connect-src 'none'; ...` | 物理禁止 fetch/XHR/WebSocket |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | 强制 HTTPS |
| `X-Frame-Options` | `DENY` | 防点击劫持 |
| `X-Content-Type-Options` | `nosniff` | 防 MIME 嗅探 |
| `Referrer-Policy` | `no-referrer` | 不发送来源信息 |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=(), ...` | 禁用所有设备权限 |
| `Cross-Origin-Opener-Policy` | `same-origin` | 跨源隔离 |
| `Cross-Origin-Embedder-Policy` | `require-corp` | 启用跨源隔离 |

**关键技术亮点：`connect-src 'none'`**

这是 Lumi 隐私承诺的核心。从浏览器层面**物理禁止**任何网络请求：
- ❌ `fetch()` 失败
- ❌ `XMLHttpRequest` 失败
- ❌ `WebSocket` 失败
- ❌ `navigator.sendBeacon` 失败
- ❌ `<img>` 跨域加载失败（除非加白名单）

用户可通过 DevTools → Network 面板验证：操作 Lumi 全程零请求。

### 数据层

- ✅ 数据仅存于用户浏览器 IndexedDB
- ✅ 不在 URL 中暴露任何数据（无 query string 含 PII）
- ✅ 导出 JSON 包含 `schemaVersion` 字段，便于兼容性处理
- ✅ 一键清空所有数据（二次确认）

### 部署层

- ✅ Cloudflare 自动 HTTPS + 自动证书续期
- ✅ GitHub Secrets 加密存储 API Token
- ✅ GitHub Action 仅在 main 分支自动部署
- ✅ Force push 权限受 GitHub 保护

## 🐛 报告安全漏洞

**请勿**在 GitHub Issues 中公开报告安全问题。

### 联系方式

发送邮件至：<SECURITY@LUMI.EXAMPLE> （替换为真实邮箱）

### 报告应包含

1. **漏洞描述**：问题是什么
2. **影响范围**：哪些用户受影响、严重程度
3. **复现步骤**：详细步骤
4. **概念验证**（PoC）：如有
5. **建议修复**（可选）

### 我们的承诺

- ✅ **48 小时内**确认收到
- ✅ **定期更新**处理进度
- ✅ **负责任披露**：修复后公开致谢（除非你要求匿名）
- ✅ **不追究善意研究**

## 🛠️ 已知限制

### 浏览器指纹

虽然我们不主动追踪，但浏览器仍可能泄露：
- IP 地址（任何 HTTP 服务都看得到）
- User-Agent 字符串
- 屏幕尺寸、时区

Cloudflare 会记录这些用于路由和 DDoS 防护，但**不会用于追踪用户**。

### 本地攻击面

如果攻击者获得了用户设备的物理/远程访问权限：
- ⚠️ IndexedDB 数据可被读取
- ⚠️ 浏览器 DevTools 可读取所有应用数据

这是**所有本地优先应用**的固有限制。建议用户：
- 使用设备锁屏
- 启用全盘加密（如 FileVault、BitLocker）
- 不在公共设备上使用 Lumi

### 第三方依赖风险

Lumi 的所有依赖在构建时打包到 bundle。但若有依赖被供应链攻击（如 npm 账户被盗），构建产物可能被植入恶意代码。

缓解：
- ✅ 使用 `package-lock.json` 锁定版本
- ✅ GitHub Dependabot 监控（建议启用）
- ✅ 构建过程在 GitHub Actions 沙箱中运行（隔离环境）

## 🔄 历史事件

### 2026-07-24：Cloudflare Token 泄露事故

**发生了什么**：在自动化配置过程中，Cloudflare API Token 短暂泄露到 GitHub 仓库的 commit 中。

**影响**：
- Token 在 GitHub 暴露约 **15 分钟**
- 仅 main 分支的一个 commit 受影响
- 没有证据表明 Token 被滥用

**响应**：
1. 立即识别问题
2. 使用 `git rm --cached` + `git commit --amend` + `git push --force` 从 Git 历史中移除
3. 用户轮换 Token
4. 添加 `.gitignore` 规则防止再发生
5. 更新部署流程避免临时文件被意外提交

**教训**：
- 临时配置文件不应使用真实凭证
- 部署前应检查 `git status` 是否包含敏感文件
- 轮换 Token 应作为标准流程

## 🔐 推荐的 Lumi 用户安全实践

作为 Lumi 用户，建议：

1. **定期导出备份**：每月 Settings → 导出数据 → 保存 JSON 到加密位置
2. **谨慎分享截图**：截图前隐藏敏感数据（如昵称、备注）
3. **退出时关闭浏览器**：虽然 IndexedDB 持久化，但关闭可清理会话状态
4. **不要在公共电脑使用**：网吧、共享电脑等
5. **报告可疑行为**：发现异常立即报告

## 🚧 未来安全增强

### V2（备孕模式）

- 🔜 加密备份（AES-GCM + 用户密码）
- 🔜 浏览器外的加密导出
- 🔜 双因素认证（如未来加云同步）

### V3（云同步，可选）

- 🔜 端到端加密（E2EE）
- 🔜 用户自托管（不是 Lumi 服务器）
- 🔜 加密密钥不离开用户设备

## 📚 安全资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [MDN: IndexedDB security](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

## 📮 联系方式

- 安全问题：<SECURITY@LUMI.EXAMPLE>
- 一般问题：GitHub Issues

---

> 最后更新：2026-07-24（v1.3）