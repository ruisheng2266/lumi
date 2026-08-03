# Sign in with Apple — 启用指南

> 适用版本：**v0.7.3+**（前端按钮 + `wrangler.toml` 公开变量已就绪；本文件补齐 Apple 开发者后台配置 + 4 条 `wrangler secret put`，用于激活真实登录）。
> 状态：**代码层 100% 完成并已部署，仅差你方 Apple 开发者凭证即可激活**。

---

## 1. 架构概述（已实现的流程）

Lumi 的 Apple 登录是**服务端驱动**流程（与 Google 的前端 SPA 跳转不同）：

```
设置页「用 Apple 登录」按钮
   └─ window.location → GET /auth/apple/login
        ├─ 生成 state + PKCE verifier，写入 HttpOnly cookie（/auth/apple/callback）
        └─ 302 → https://appleid.apple.com/auth/authorize?client_id=...&code_challenge=...
              └─ 用户在 Apple 页授权
                   └─ POST /auth/apple/callback （Apple form POST）
                        ├─ 校验 state（CSRF）+ PKCE code_verifier
                        ├─ code 换 token（client_secret = p8 动态签发的 ES256 JWT）
                        ├─ 用 Apple 公开 JWKS 验 id_token 签名（ES256，校验 iss/aud/exp）
                        └─ completeOAuthLogin(env.DB, {provider:'apple', sub, email, name})
                             └─ upsertUser 写 users(apple_id, email, name) + 种 session cookie
                                  └─ 302 → /settings（已登录）
```

**关键文件（均已就绪，无需改动）**
| 文件 | 作用 |
|---|---|
| `functions/auth/apple-login.ts` | 发起授权，读 `APPLE_CLIENT_ID` / `APPLE_REDIRECT_URI` / `PUBLIC_URL` |
| `functions/auth/apple-callback.ts` | 回调：PKCE + token 交换 + id_token 验签 + 完成登录；读 `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_P8` / `APPLE_CLIENT_ID` / `APPLE_REDIRECT_URI` / `PUBLIC_URL` / `DB` |
| `functions/utils/apple-jwt.ts` | `generateAppleClientSecret`（p8 → ES256 JWT，exp=now+6 个月）/ `verifyAppleIdToken`（JWKS 验签） |
| `functions/utils/pkce.ts` | PKCE 挑战值 |
| `functions/utils/oauth.ts` | `completeOAuthLogin`：写 `users.apple_id`（迁移 0002 已 apply）+ session cookie |
| `src/pages/Settings.tsx` | 「用 Apple 登录」黑色按钮（lucide `Apple` 图标），点击跳 `/auth/apple/login` |
| `wrangler.toml` | 公开变量 `APPLE_REDIRECT_URI = "https://lumi365.com/auth/apple/callback"` |

**隐私兼容（已实现）**
- 支持 Apple **隐私中继邮箱**（`*@privaterelay.appleid.com`）：Apple 仅在首次授权回传 `name`，后续为空，`apple-callback.ts` 已兼容（`name` 为空时不报错）。
- 不强制登录、不打扰，符合 Lumi 隐私优先定位。

---

## 2. 你需要做的第 1 步：Apple Developer 后台配置

> 需要 **Apple Developer Program** 付费账号（$99/年）。登录 https://developer.apple.com → Account → Certificates, Identifiers & Profiles。

### 2.1 创建 Services ID（用于 Web 登录）
1. 左侧 **Identifiers** → 右上 **+** → 选择 **Services ID** → Continue。
2. 填写：
   - **Description**：`Lumi`
   - **Identifier**（反向域名，全局唯一）：建议 `com.lumi.app` 或 `com.lumi.web`（记下来，这就是 `APPLE_CLIENT_ID`）。
   - 勾选 **Sign in with Apple** → 点 **Configure**。
3. 在弹窗里：
   - **Primary App ID**：选择/创建一个 App ID（没有就新建一个占位 App ID，Web 登录只需要它来挂靠）。
   - **Website URLs**：
     - **Domains and Subdomains**：`lumi365.com`
     - **Return URLs**：`https://lumi365.com/auth/apple/callback`
   - **Save** → **Continue** → **Register**。

### 2.2 创建 Auth Key（用来签 client_secret）
1. 左侧 **Keys** → 右上 **+** → **Create a key**。
2. 填写 **Key Name**（如 `Lumi Apple Key`），勾选 **Sign in with Apple** → 点 **Configure**。
3. Configure 里选择 **Primary App ID**（同上）→ 可在此指定允许使用的 Services ID → **Save** → **Continue** → **Register**。
4. **⚠️ 立即 Download**，得到 `AuthKey_XXXXXXXXXX.p8` 文件。**该文件只能下载一次**，务必妥善保存。
5. 记下：
   - **Key ID**：页面显示，也在文件名 `AuthKey_<KeyID>.p8` 里（这就是 `APPLE_KEY_ID`）。

### 2.3 记录 Team ID
- 左上角 **Membership** 页（或 Account 首页）→ 复制 **Team ID**（这就是 `APPLE_TEAM_ID`）。

---

## 3. 你需要做的第 2 步：设置 4 个 Cloudflare Secret

在本地仓库根目录的终端执行（交互式输入，回显会被隐藏，不会进日志）：

```bash
cd E:/aiProject/女性健康追踪

npx wrangler secret put APPLE_CLIENT_ID --project-name lumi
# 提示输入时，粘贴 Services ID，例如：com.lumi.app

npx wrangler secret put APPLE_TEAM_ID --project-name lumi
# 粘贴 Team ID（Membership 页）

npx wrangler secret put APPLE_KEY_ID --project-name lumi
# 粘贴 Key ID（AuthKey_ 后的 10 位）

npx wrangler secret put APPLE_P8 --project-name lumi
# 粘贴 .p8 文件全文（含 -----BEGIN PRIVATE KEY----- 与 -----END PRIVATE KEY----- 两行）
```

> 设完任意一个 secret，Cloudflare 都会**自动重新部署一次**。4 条都设完后部署即生效。

### 环境变量名对照（与代码严格一致，勿改名）
| Secret 名 | 来源 | 说明 |
|---|---|---|
| `APPLE_CLIENT_ID` | Services ID（§2.1） | 如 `com.lumi.app` |
| `APPLE_TEAM_ID` | Membership（§2.3） | 10 位字母数字 |
| `APPLE_KEY_ID` | Auth Key（§2.2） | 10 位字母数字 |
| `APPLE_P8` | 下载的 `.p8` 全文（§2.2） | 含 BEGIN/END 行 |
| `APPLE_REDIRECT_URI`（公开） | 已写入 `wrangler.toml` | `https://lumi365.com/auth/apple/callback` |

---

## 4. 激活后验证清单

部署完成后，用**新账号**（未登录过 Lumi）走一遍：
1. 打开 `https://lumi365.com/settings` → 点「用 Apple 登录」。
2. 跳转到 `appleid.apple.com` → 用 Apple ID 授权（可选「隐藏邮件」测试隐私中继）。
3. 应自动跳回 `/settings` 且显示已登录（头像/邮箱）。
4. 验证下游能力对 Apple 账号同样生效：
   - 启用加密同步（E2EE vault）——`users.apple_id` 已落库，`getUserId` 按 session 取，与 Google 账号无差异。
   - 如需购买 Plus：走 PayPal 流程，`custom_id` 用 `apple:<sub>` 前缀，webhook 正常落 `plan`。

---

## 5. 故障排查

| 现象 | 原因 / 解决 |
|---|---|
| 点按钮后 Apple 报「invalid_request / client_id」 | `APPLE_CLIENT_ID` 未设或值与 Services ID 不符。检查 §3 命令是否成功执行（`wrangler secret list --project-name lumi` 核对 4 条都在）。 |
| `redirect_uri_mismatch` | Services ID 配置的 Return URL 与 `wrangler.toml` 的 `APPLE_REDIRECT_URI` 不一致（必须都是 `https://lumi365.com/auth/apple/callback`，含 `https`）。 |
| `client_secret` 相关错误 | `APPLE_P8` 内容不完整（缺 BEGIN/END 行）或 revoke。重新下载 .p8 并 `wrangler secret put APPLE_P8`。代码每次动态签 exp=now+6 个月的 JWT，只要 p8 有效即长期可用。 |
| 登录后姓名显示为空 | 正常：Apple 仅**首次授权**回传 `name`，之后用隐私中继登录不再返回。代码已兼容，不影响登录。 |
| `state mismatch` / `PKCE verification failed` | cookie 被拦截或跨域。确保回调域名与 `PUBLIC_URL` 一致，且浏览器未禁用第三方 cookie 阻断 `/auth/apple/callback` 路径的 HttpOnly cookie。 |

---

## 6. 已知边界

- **账号不自动合并**：`completeOAuthLogin` 按 `provider + sub` 定位用户。同一邮箱先用 Google 登录、再用 Apple 登录，会生成**两条独立账号**（Apple 回传的 email 可能是隐私中继地址，无法可靠匹配）。如需合并需后续产品决策，当前不处理。
- **App Store 上架**：Apple 审核指南要求含第三方登录（Google/Facebook 等）的 App 必须提供「用 Apple 登录」。Lumi 当前是 Web PWA；若未来上架 iOS App，本端点可直接复用，仅需在 App 内同样接入。
- **撤销**：在 Apple Developer → Keys 里 revoke Auth Key 即立即使 Apple 登录失效；重新生成 Key 并更新 `APPLE_KEY_ID` / `APPLE_P8` 即可恢复。
