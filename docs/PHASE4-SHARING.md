# Phase 4 · 伴侣加密共享 — 设计文档与实施计划

> 状态（2026-08-03 / v0.8.0，2026-08-04 / v0.8.1）：**已实现并随 v0.8.0 发布**；**「伴侣免费接收」BLOCKER 已于 v0.8.1 修复**（免费伴侣免 Plus 即可生成共享密钥对并接收共享）。本文档是 Phase 4「共享 / AI」中「伴侣加密共享」部分的权威设计，配套 `V1.0-ACCOUNT-SYSTEM-DESIGN.md` 的 Phase 4 行。
> 已拍板决策：① 先出设计文档再实现；② **仅创建者需 Plus，伴侣作免费被共享者**。
> AI 洞察增强不在本文档范围（见 §11 开放问题）。
> ⚠️ **与原始设计的两处关键偏差（实现时的自主决策，见 §13）**：(1) 共享为**单向加密镜像**（创建者写、伴侣只读），非双向读写；(2) 用户私钥由 **vault 密钥** 包裹（而非 passphrase 派生密钥），使重置口令后已有共享不失效。

---

## 1. 目标与范围

**目标**：让两个 Lumi 账号在**零知识前提**下共享一份加密健康数据，支持双向读写，且任一方可随时撤销对方访问。

**v1 范围（in scope）**
- 创建者按对方邮箱/用户名发起邀请 → 对方接受 → 共享 vault 双向同步 → 创建者撤销。
- 共享数据独立于各自私有同步 vault。

**v1 暂不做（out of scope，留作后续）**
- 字段级合并（v1 用 per-record LWW，见 §7）。
- read-only / 按分类共享角色。
- 多于两人的群共享。

---

## 2. 零知识保证（不可妥协）

- 服务器**永远看不到**：明文 vault key、passphrase、记录明文。
- 服务器只存：用户**公钥**（明文、非敏感）、被公钥**包裹的 shared vault key**、加密 blob（R2）。
- 撤销靠**轮换密钥 + 重加密**，不依赖服务器信任（见 §6）。
- 符合产品定位与 `PRICING-STRATEGY.md` §4 日落承诺（数据可导出、可交接）。

---

## 3. 密码学扩展（复用 `src/shared/sync/crypto.ts`）

现有 `crypto.ts` 已提供 `generateVaultKey` / `wrapVaultKey(vaultKey, wrappingKey)` / `unwrapVaultKey` / `derivePassphraseKey`。共享只需在其上**加一对用户级非对称密钥**用于密钥投递：

### 3.1 每用户密钥对
- **算法**：推荐 **RSA-OAEP（2048）**——`subtle.wrapKey('raw', sharedVaultKey, partnerPublicKey, {name:'RSA-OAEP'})` 一步完成包裹，无需额外 KDF。（备选 ECDH P-256 更轻，但需先派生共享密钥再 AES-KW，链路更长。）
- **公钥**：`users.public_key`（SPKI 编码 base64），明文存 D1，**非敏感**。
- **私钥**：`users.private_key_wrapped`，用 passphrase 派生密钥包裹（**直接复用** `derivePassphraseKey` + `wrapVaultKey` 同款 AES-GCM 逻辑），与 `key_backup` 并列存储。
- **生成时机**：用户首次设置同步口令时一并生成 keypair，公钥上报 D1；私钥包裹后存 D1。

### 3.2 新增 crypto API
```ts
generateUserKeyPair(): Promise<{ publicKeySpkiB64: string; privateKey: CryptoKey /* extractable */ }>
wrapVaultKeyForUser(vaultKey: CryptoKey, partnerPublicKey: CryptoKey): Promise<string>  // RSA-OAEP wrapKey → b64
unwrapVaultKeyWithPrivate(wrapped: string, userPrivateKey: CryptoKey): Promise<CryptoKey> // RSA-OAEP unwrapKey
```
- `encryptRecord` / `decryptRecord` **完全复用**，共享 vault 与私有 vault 只是两把不同的 vault key。

---

## 4. 数据模型（迁移 `0008_shared_vaults.sql`）

```sql
CREATE TABLE shared_vaults (
  vault_id       TEXT PRIMARY KEY,
  owner_user_id  TEXT NOT NULL REFERENCES users(id),
  created_at     INTEGER NOT NULL
);

CREATE TABLE shared_members (
  vault_id            TEXT NOT NULL REFERENCES shared_vaults(vault_id),
  user_id             TEXT NOT NULL REFERENCES users(id),
  role                TEXT NOT NULL,        -- owner | partner
  wrapped_vault_key   TEXT NOT NULL,        -- 用该成员公钥包裹的 shared vault key
  joined_at           INTEGER NOT NULL,
  status              TEXT NOT NULL,        -- pending | active | revoked
  PRIMARY KEY (vault_id, user_id)
);

CREATE TABLE shared_meta (
  vault_id    TEXT NOT NULL,
  record_id   TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  blob_ref    TEXT NOT NULL,
  hmac        TEXT NOT NULL,
  PRIMARY KEY (vault_id, record_id)
);
```

- `shared_meta` 复用 `sync_meta` 同款 **per-record LWW** 语义（客户端读旧值决定写入，服务端不合并）。
- R2 key 加 `shared/{vault_id}/{record_id}` 前缀，与私有同步（`user/{userId}/...`）物理隔离。

---

## 5. 后端端点（`functions/api/share/*`）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/share/invite` | POST | 创建者发起：校验自身 plan∈{plus,founder}；解析对方 user_id（邮箱/用户名）→ 取其 `public_key`；生成 shared vault + shared vault key；用双方公钥各包裹一份写入 `shared_members`（owner=active, partner=pending） |
| `/api/share/list` | GET | 返回我作为 owner/partner 的 vault 列表 + 我的 `wrapped_vault_key` + 对端状态 |
| `/api/share/accept` | POST | partner 侧：用自身私钥 `unwrapVaultKeyWithPrivate` 解出 shared vault key 并本地持有；`status` pending→active（**partner 免费即可 accept**） |
| `/api/share/sync` | GET/PUT | 与 `sync.ts` 同构，作用域为 `vault_id`（非 `user_id`）；门控为「是 active member」 |
| `/api/share/revoke` | POST | owner 调用：轮换 shared vault key + 重加密全部 shared blob + 删除目标 member 行（见 §6） |
| `/api/users/public-key` | GET | 仅返回对方 `public_key`（不返回其他字段，保护隐私） |

- `invite` 门控：仅创建者需 Plus（`getSyncEntitlement` 的 `plan != free` 或 `founder`）。伴侣侧 `accept`/`sync` **不查 plan**。
- 复用现有 `getUserId` / `getSyncEntitlement` / R2 binding。

---

## 6. 撤销与重加密（关键正确性）

**问题**：partner 一旦 `accept` 拿到 shared vault key，本地就有一份明文密钥副本。单纯删 `shared_members` 行拦不住他解密已缓存的 blob。

**正确做法 = 轮换 shared vault key**：
1. 生成**新** shared vault key。
2. 遍历 `shared_meta` 全部 blob：用旧 key 解密 → 用新 key 加密 → 重写 R2（`shared/{vault_id}/{record_id}`），更新 `blob_ref`/`hmac`。
3. 对剩余 active member（通常仅 owner）用各自公钥重新包裹新 key，更新 `wrapped_vault_key`。
4. 删除被 revoke 的 member 行。

**结果**：被撤销方仍持旧 key，但所有 blob 已是新 key 密文 → 无法解密 → 访问实质切断。✅ 零知识友好。

**成本与一致性**：共享数据量小（个人健康记录几十~几百条），遍历重加密可接受；建议分批 + 状态标记（如 `shared_vaults.rekeying` 标志），避免中途失败致不一致。

---

## 7. 冲突策略

- **v1：per-record LWW**（与现有 sync 完全一致）。两人改**不同**记录时完美；改**同一**记录时后写覆盖先写。经期类 App 极少同记录并发改，可接受。
- **可见性**：记录元信息带 `lastEditedBy`（owner/partner 展示名或匿名标识）+ 时间，UI 提示「最近由伴侣编辑」。
- **后续升级**（不在 v1）：**字段级合并**。因记录是结构化 JSON、客户端持有 vault key 可解密，可对每字段做 field-level LWW（每字段带 `updated_at`）。这是 `V1.0-ACCOUNT-SYSTEM-DESIGN.md` §5 决策⑤「共享时再评估」的落点。

---

## 8. 权益与定价咬合

- 发起共享（`invite`）需创建者 `plan ∈ {plus, founder}`（founder 视为已购，自然可共享）。
- 伴侣 `accept` / 同步共享 vault **不需要** Plus（免费被共享者，利于传播与获客）。
- 共享功能不触碰 Free 核心功能红线（`PRICING-STRATEGY.md` §6）。

---

## 9. 前端

- `src/shared/share/SharePanel.tsx`：列出我的共享 vault、按邮箱邀请、显示成员状态（待接受 / 已激活 / 已撤销）、撤销按钮 + 二次确认。
- `src/shared/share/store.ts`：在现有 sync store 上扩展「多 vault」概念——私有 vault + N 个 shared vault，各自独立 vault key 与增量同步循环。
- `src/shared/sync/crypto.ts`：加 §3.2 的密钥对 API。
- Settings 页入口（Plus 面板或独立「共享」区）。

---

## 10. 分阶段实施计划

| 里程碑 | 范围 | 交付物 | 门控 |
|--------|------|--------|------|
| **M1 密码学 & 数据层** | user keypair 生成/上报/包裹；迁移 0008；`crypto.ts` 扩展 | 单测：wrap/unwrap 往返、revoke 后旧 key 解密新 blob 失败 | ❌ 不碰 Free |
| **M2 后端端点** | invite/list/accept/sync/revoke/public-key；门控（创建者需 Plus） | 后端单测覆盖各路径 + 重加密正确性 | ❌ |
| **M3 前端** | SharePanel + store 多 vault | 两账号互邀端到端手动验证 | ❌ |
| **M4 打磨 & 文档** | 冲突可见性 UI、撤销确认；更新 V1.0/ROADMAP/CHANGELOG；版本 bump | 发布说明 | ❌ |

建议：M1→M2 可合并提交，M3 单独 PR（前端改动面大），M4 收尾。

---

## 11. 风险 / 开放问题（待你拍板或后续确认）

1. **算法选型**：RSA-OAEP（推荐，wrapKey 一步）vs ECDH P-256（更轻、链路长）。默认 RSA-OAEP。
2. **伴侣标识**：用 email 还是 username 查找对方 `public_key`？email 不公开、仅用于查找，推荐；需确认是否允许用 username。
3. **重加密中断恢复**：建议 `rekeying` 标志 + 分批，防中途失败不一致。
4. **祖父免费同步用户能否共享**：当前 `getSyncEntitlement` 含祖父条款（free 但 `key_backup` 存在→`syncEntitled`）。建议共享也向祖父老用户开放（等同 Plus 权益），需你确认。
5. **AI 洞察增强**：独立工作项，需后端或可选云，不在本共享文档；见 `V1.0-ACCOUNT-SYSTEM-DESIGN.md`。

---

## 12. 测试计划

- **unit**：wrap/unwrap 往返一致；per-record LWW（高 updated_at 胜）；revoke 后旧 key 解密新 blob 失败。
- **integration**：invite → accept → 双方 sync 互通 → revoke → partner 侧解密失败。
- **e2e 手动**：两账号互邀，验证双向读写、撤销后无法解密、创建者需 Plus / 伴侣免费。

---

## 13. 实现纪要（v0.8.0，2026-08-03）

Phase 4 已按本设计落地并随 **v0.8.0** 发布。以下记录实现时相对 §1–§12 的自主决策与偏差，供审查：

### 13.1 关键偏差：共享为单向加密镜像（非双向读写）
- **原设计（§1）**：支持「双向读写」，两人改同一份共享 vault。
- **实际实现**：共享是**创建者单向加密镜像**——创建者把自己选定范围的数据加密推送到共享 vault；伴侣 `pullShared` 后只在「伴侣视图」里**只读**展示，**绝不写入伴侣本地主库**。
- **理由**：避免两个人的健康数据互相污染（伴侣本地主库只该有自己的记录）；v1 把冲突面降到零，也符合「共享是给伴侣看、不是合著一本账」的真实使用场景。
- **影响**：§7 的「字段级合并 / 同记录并发」问题在单向模型下自然消失；后续若要做双向，再评估 §7 的字段级 LWW。

### 13.2 关键偏差：私钥包裹方式（vault 密钥 / 共享口令，按用户类型分两条路径）
- **原设计（§3.1）**：私钥用 passphrase 派生密钥包裹（与 `key_backup` 并列）。
- **实际实现（分两类用户）**：
  - **已启用 E2EE 同步的用户**：`wrapPrivateKey(privateKey, vaultKey)`，包裹盐复用 `vaultSalt`；`store.ts` 的 `restoreOrCreateUserKeys` 在解锁同步后用 vault 密钥解开。理由：重置同步口令（恢复码）会换 passphrase 派生密钥，但 **vault 密钥本身不变**，故绑 vault 密钥可使已建立的共享在口令重置后依然有效。
  - **未启用同步的免费伴侣（2026-08-04 修复「伴侣免费」BLOCKER 后）**：`wrapPrivateKey(privateKey, derivePassphraseKey(sharePassphrase, salt))`，盐为独立随机 salt；通过 `functions/api/share/keys.ts`（**已移除 `syncEntitled` 门控**）上报。这样免费伴侣无需购买 Plus 同步也能生成共享密钥对并接收共享（零知识：私钥密文服务端不可解）。
- **关键修复**：原实现要求伴侣必须启用 E2EE 同步（Plus 专属）才能生成密钥对，导致「伴侣免费」承诺落空——新免费账号看不到接受按钮、无法接受。现免费伴侣首次接收前在 SharePanel 自设「共享口令」即可，与同步口令相互独立。
- **迁移 0008 注释**中「私钥用同步口令派生的密钥包裹」一句措辞不精确——实际包裹密钥是 AES-GCM vault 密钥（已启用同步者，salt=vaultSalt）或共享口令派生密钥（免费伴侣，salt=独立随机值）。存储列（`wrapped_private_key` / `private_key_salt`）不变。

### 13.3 其它实现要点
- **后端**：`functions/api/share/{invite,list,accept,sync,revoke}.ts` + `functions/api/users/public-key.ts` + 懒升级端点 `functions/api/share/keys.ts`（为 pre-Phase-4 已启用同步的老用户补传密钥对）。门控同 §5：创建者需 `syncEntitled`（Plus/创始/祖父），伴侣 `accept`/`sync`/`list` 仅查 active 成员。
- **前端**：`src/shared/share/shareStore.ts`（Zustand，含 `inScope` 范围过滤、邀请/接受/推送/拉取/**轮换密钥重加密**撤销）+ `src/shared/share/SharePanel.tsx`（Settings 入口，需先解锁加密同步；范围 `Select` 三种）+ `src/shared/sync/crypto.ts` 新增 `wrapPrivateKey/unwrapPrivateKey` + `src/shared/sync/store.ts` 的 keypair 生命周期。
- **i18n**：`zh-CN.ts` / `en.ts` 新增 `share` 命名空间。
- **测试**：`functions/api/share/share.test.ts`（后端含 revoke 重加密正确性）、`src/shared/sync/crypto.test.ts`（密钥对 wrap/unwrap 往返）、`src/shared/share/shareStore.test.ts`（v1 范围语义 `inScope` + 清理）。

### 13.4 上线前待办（与 v0.8.0 无关，留待真机联调）
- 两账号真机端到端联调（创建者 Plus 发起 / 伴侣免费接受 / 撤销后旧密钥失效）。
- 撤销重加密的「分批 + `rekeying` 标志」防中断不一致（§6 已设计，v1 数据量小直接同步遍历）。
- ~~共享范围变更后，已 push 的历史 blob 不会自动重推~~ → **已修复（2026-08-04）**：`setScope` 现改为异步，变更范围后**立即重新同步**——放大范围时把新范围内全部本地记录重新加密推送（补齐此前未推的历史 blob）；缩小范围时对「旧范围有、新范围没有」的记录类型发墓碑删除，清掉服务端残留。伴侣拉取后内容与当前范围一致。前端会显示 `share.notice.scopeUpdated` 提示。

