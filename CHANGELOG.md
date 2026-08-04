# Changelog

## v0.8.0 — 伴侣加密共享（Phase 4）· 2026-08-03

**新增 · 伴侣加密共享（零知识）**
- 创建者可将自己选定的经期 / 症状数据，以端到端加密方式分享给伴侣；数据只有双方能解密，服务器仅存公钥与被公钥包裹的共享密钥。
- 每用户 RSA-OAEP 2048 密钥对：公钥明文存库（非敏感），私钥由 vault 密钥包裹；用对方公钥一步 `wrapKey` 投递共享 Vault 密钥。
- 后端 6 端点：`/api/share/{invite,list,accept,sync,revoke}` + `/api/users/public-key`，外加懒升级端点 `/api/share/keys`（为已启用同步的老用户补传密钥对）。迁移 `0008`（shared_vaults / shared_members / shared_meta）+ R2 前缀 `shared/{vaultId}/{recordId}`。
- 撤销 = **轮换共享密钥 + 全量重加密**：被撤销方留存的旧密钥将无法解密任何新 blob，不依赖服务端"守信"。
- 前端：`SharePanel`（设置页入口，需先解锁加密同步）、`shareStore`（邀请 / 接受 / 推送 / 拉取 / 轮换密钥重加密撤销）、范围选择（仅经期 / 经期+每日记录 / 全部）。
- 权益：仅发起共享的创建者需 Plus 或创始身份；伴侣接受与查看**永久免费**。

**实现决策（详见 `docs/PHASE4-SHARING.md` §13）**
- 共享为**单向加密镜像**：创建者写、伴侣只读，伴侣数据不写入本地主库，避免两人健康数据互相污染。
- 用户私钥由 **vault 密钥**包裹（非 passphrase 派生密钥），使重置同步口令后已有共享不失效。

**测试**
- `functions/api/share/share.test.ts`（后端，含撤销重加密正确性）、`src/shared/sync/crypto.test.ts`（密钥对 wrap/unwrap 往返）、`src/shared/share/shareStore.test.ts`（v1 范围语义 + 清理）。

**i18n**
- `zh-CN` / `en` 新增 `share` 命名空间。

---

## 历史版本摘要
- v0.7.x：打赏 Donation 入口、匿名使用统计 + 本地周期提醒、Apple 登录端点就绪（暂缓启用）。
- v0.6.0：Phase 3 Plus 权益 + 支付（PayPal 沙箱全链路真机验证通过）。
- v0.5.0：洞察深化 + 围绝经期 + 备孕（BBT）+ 健康科普。
- v0.4.x：导入、特殊生理场景、诚实预测、a11y 量化、医生 PDF 报告。
- v0.3.x：i18n、PWA、主题、洞察修复。
- v0.2.0：MVP。
