# Phase 4 伴侣加密共享 · 两账号真机联调 Checklist

> 配套：`docs/PHASE4-SHARING.md`（设计 + §13 实现纪要）、`src/shared/share/shareStore.ts`、`src/shared/share/SharePanel.tsx`。
> 目的：用**两个真实账号**跑通 v0.8.0 零知识共享的完整闭环，验证「邀请 → 接受 → 推送/拉取 → 撤销重加密」与「范围变更重推」。
> 最后更新：2026-08-04。

---

## ⚠️ 必读：历史阻断（BLOCKER，已于 2026-08-04 修复）

> **状态：已修复并随 v0.8.1 发布。** 下方为修复前的因果链，保留作审计。

原「伴侣免费」未实现——新免费账号无法完成接受流程。因果链：

1. 接受共享需伴侣用本人私钥解开共享 vault 密钥（`ensureSharedKey` → `getUserPrivateKey()`，见 `shareStore.ts:139-141`）。
2. 私钥只在「启用 E2EE 同步」时生成（`sync/store.ts` 的 `restoreOrCreateUserKeys`，且必须由 vault 密钥包裹）。
3. `functions/api/sync-setup.ts:70` 与 `src/shared/sync/SyncPanel.tsx:101` 对启用同步要求 `syncEntitled`（免费 → 402 / 升级提示）；`functions/api/share/keys.ts:31` 同样 402。
4. `SharePanel.tsx:81` 在 `syncStatus !== 'ready'` 时直接渲染「开启加密同步后，才能与伴侣共享」卡片，**不渲染接受按钮**。

⇒ 新免费伴侣：看不到接受按钮 → 无法接受 → 「伴侣免费」承诺落空。
⇒ 仅**祖父化老用户**（Phase 3 前已有 `key_backup`，`syncEntitled` 仍为 true）能碰巧走通，掩盖该 bug。

**修复（v0.8.1）**：`share/keys.ts` 移除 `syncEntitled` 门控；`sync-setup GET` 让免费用户也能取回共享密钥材料；新增 `setupShareKeypair`/`unlockShareKeypair`（免费伴侣用独立「共享口令」PBKDF2 包裹私钥）；`SharePanel` 放开 `ready` 门控，免费伴侣侧显示「设置共享口令」卡与接受表单。详见 `PHASE4-SHARING.md §13.2`。

**联调仍建议用「新免费账号」作伴侣**，以验证修复确实生效（用祖父老号会碰巧通过、无法验证修复）。在 BLOCKER 修复前，T3/T4/T6/T7 对免费伴侣必失败。

---

## 0. 环境与账号准备

| 角色 | 要求 | 说明 |
|------|------|------|
| **账号 A（创建者）** | 必须 `syncEntitled`（Plus / 创始 / 祖父） | 共享是 Plus 专属发起权 |
| **账号 B（伴侣）** | **新注册免费账号**（无 Plus、无 `key_backup`） | 用来暴露 BLOCKER；若用祖父老号会假通过 |
| 浏览器 | 两个独立 Profile / 两台设备 / 无痕窗口×2 | 避免同一 session cookie 串号 |

前置数据：
- A 本地录入：≥1 条经期（period）、≥1 条每日记录（dailyLog），可选 1 条档案（profile）/ 生活事件（lifeEvent）。
- B 本地录入：任意数据（用于验证「单向镜像不污染对方主库」）。

登录方式：Google OAuth（两端各自登录）。

---

## 1. 前置门控确认

- [ ] **A 端**：设置页 → 同步面板，已「启用加密同步」（设口令、存好恢复码），状态显示「已启用」，`syncStatus === 'ready'`。
- [ ] **B 端**：设置页 → 同步面板，免费账号应看到「同步为 Plus 专属」升级提示（**当前预期行为**）；此即 BLOCKER 所在——B 无 vault 密钥、无私钥。
- [ ] 两端 SharePanel 标题「伴侣共享」可见。

---

## 2. T1 · 创建者发起邀请

**步骤（A 端 SharePanel）**
1. 邮箱输入 B 的账号邮箱。
2. 范围选「经期 + 每日记录」（`symptoms`）。
3. 点「发送邀请」。

**预期**
- 顶部提示：`已发送邀请，等待对方接受`（notice=`invited`）。
- 「我发起的共享」出现一条：伴侣状态=`等待接受`（pending），`epoch=1`。
- 后端核验：`shared_vaults` 新增 1 行；`shared_members` 2 行（owner=active、partner=pending）；双方 `wrapped_vault_key` 非空。

**通过标准**：A 端出现 pending vault 且 epoch=1；D1 成员行齐全。

---

## 3. T2 · 伴侣设置共享口令 + 看到邀请

**前置（关键）**：创建者邀请时后端 `public-key` 端点需要伴侣**已上传公钥**，故 B 必须先设置共享口令（见下），A 才能成功邀请。顺序不可颠倒。

**步骤（B 端 SharePanel）**
1. 登录后打开设置 → 伴侣共享。免费账号应看到「设置共享口令」卡片（无需启用同步）。
2. 输入并确认一个共享口令，点「设置共享口令并准备接收」→ 提示「共享口令已就绪」。
3. 此时 A 端（T1）用 B 的邮箱发起邀请成功。
4. B 端刷新/返回后，「我加入的共享」出现该 vault，状态=`待接受`（pending）+「设置共享口令并接收」按钮（因本会话已设过，也可直接「接受」）。

**预期**
- 修复后（v0.8.1）：B 即使未启用同步也能看到 pending vault 并有接受入口；设置共享口令后公钥已上报，`public-key` 端点可返回。
- 历史 BLOCKER（已修）：旧版 B 因 `syncStatus!=='ready'` 看不到接受按钮，且 `share/keys` 返回 402。

**通过标准**：B 能看到 pending 邀请、设有共享口令、且 A 成功发出邀请（无 `user_not_ready` 409）。

---

## 4. T3 · 伴侣接受（核心验证点）

**步骤（B 端）**
- 若本会话已设共享口令（内存有私钥）：直接点「接受」。
- 若刷新后重入（内存无私钥但服务端有）：在 pending 卡片输入共享口令，点「设置共享口令并接收」→ 内部先解锁私钥再接受。

**预期（修复后）**
- 提示：`已接受共享，开始同步`（notice=`accepted`）；状态→active。
- 自动 `pullShared`：解密成功，snapshot 出现 A 的摘要（经期数、最近经期、预测下次、日记数）。
- 历史 BLOCKER（已修）：旧版 B 无私钥 → `pullShared` 抛 `sync_locked` 或 `share/keys` 402。

**通过标准**：接受后状态 active 且能拉到 A 的加密数据明文摘要。

---

## 5. T4 · 伴侣只读视图（单向镜像验证）

**步骤（B 端）**：active 后点「查看伴侣」。
- 摘要显示 A 的 periods 数、最近经期 start、预测 nextPeriodStart、dailyLog 数。
- 检查 B **本地**经期/记录未被 A 的数据污染（伴侣视图只存内存 `snapshots`，不写 B 的 Dexie 主库）。

**通过标准**：B 看到 A 的数据；B 自己的本地库无任何 A 的记录写入（单向镜像成立）。

---

## 6. T5 · 创建者推送更新传播

**步骤**
1. A 新增 1 条经期或每日记录。
2. A 端 owned vault 点「立即推送」（`pushShared`）。
3. B 端点「查看伴侣」刷新 snapshot。

**预期**：B 看到的 counts / 最近日期相应更新（LWW 按 `updatedAt` 合并）。

**通过标准**：A 的新增数据在 B 端可见。

---

## 7. T6 · 范围变更自动重推（验证 2026-08-04 修复）

**步骤（A 端 owned vault 的范围 Select）**
1. `symptoms` → `all`：提示 `共享范围已更新，数据已重新同步`；B 拉取后应看到 profile/lifeEvent（如有）。
2. `all` → `periods`：B 拉取后 profile/lifeEvent **消失**（墓碑删除清理残留）。

**预期**：放大补齐历史 blob；缩小发墓碑清残留；B 端始终与 A 当前范围一致。

**通过标准**：范围变更后 B 端内容随范围正确增减，无残留。

---

## 8. T7 · 撤销 + 零知识重加密

**步骤（A 端 owned vault）**
1. 点「撤销」→ 出现二次确认 → 点「确认撤销」。
2. 预期提示：`已撤销对方的访问，旧数据已被重新加密`（notice=`revoked`）。
3. `key_epoch` 从 1 → 2；`shared_members` 中 B 行被删；A 的 `wrapped_vault_key` 已换为新密钥包裹。

**零知识验证（B 端）**
- B 仍持有旧私钥（内存未清）：点「查看伴侣」→ 旧记录解密失败被单条跳过，看不到 A 的新内容。
- 更彻底：B 刷新/锁定清内存后尝试重新接受 → 因已非成员应被拒（`not_member` 403）。

**通过标准**：撤销后旧密钥解不开新 blob；B 无法再读 A 数据；且不依赖服务端"守信"。

---

## 9. T8 · 撤销后重新邀请（可选）

**步骤**：A 对 B 再次「发送邀请」→ 新 vault、epoch 重置为 1、重新包裹密钥对。

**通过标准**：可干净地重建共享，无旧密钥残留风险。

---

## 10. 清理

- [ ] 联调后撤销测试 vault（无删除端点，`shared_vaults`/`shared_members` 行会留存，属正常）。
- [ ] 记录发现的任何非预期行为到本文件或 issue。

---

## 11. 修复方案（BLOCKER 落地方案）—— 已于 2026-08-04 实施（v0.8.1）

**实际落地（与下方推荐方案一致，落地于 v0.8.1）**：
- 共享密钥对（RSA-OAEP）的生成/上报**不再**依赖 E2EE 同步 vault，且 `share/keys` 的 `syncEntitled` 门控已移除（任何登录用户都能上传；公开公钥 + 口令包裹的私钥，不泄露明文）。
- `sync/store.ts` 新增 `setupShareKeypair(passphrase)`：免费伴侣未启用同步（无 vaultKey）时，用**共享口令派生密钥**（PBKDF2(passphrase)）包裹共享私钥并上传；`unlockShareKeypair(passphrase)` 供刷新后重入解锁。已启用同步的用户仍走原 `restoreOrCreateUserKeys`（vault 密钥包裹，口令重置不失效）。
- `functions/api/sync-setup.ts` GET 修复：即使免费用户无 `key_backup`，也返回共享密钥材料，使 `unlockShareKeypair` 可取回 `privateKeySalt`。
- `SharePanel.tsx` 放开 `ready` 门控（移除「未 ready 即整体隐藏」早返回）；免费伴侣侧显示「设置共享口令」卡与接受表单；仅「发起共享」仍要求 `syncEntitled`（保持 Plus 发起权）。
- 新增 i18n：`share.sharePassphraseDesc/Placeholder/confirmPassphrasePlaceholder/setupShareKey/shareKeyReady/wrongSharePassphrase/passphraseRequired/passphraseMismatch/setupShareKeyFailed`（zh-CN/en）。

**代价与说明**：免费伴侣的共享私钥由「共享口令」包裹，故**重置/遗忘共享口令**会使其需重新设置（不同于 Plus 用户绑 vault 密钥的「口令重置不失效」）。这是「伴侣免费」与「口令重置不失效」之间的取舍——免费路径不依赖付费的同步 vault，属可接受取舍，已记入 `PHASE4-SHARING.md §13.2`。

**验收**：用本 Checklist 的 T2–T7，以**新免费账号**作伴侣全部通过，即证明 BLOCKER 解除。

---

## 12. 复跑命令（开发态）

```bash
# 类型检查
npx tsc -b --noEmit
# 共享相关单测（范围语义 / 撤销重加密 / 密钥往返）
node ./node_modules/vitest/vitest.mjs run src/shared/share src/shared/sync/crypto.test.ts
# 生产构建（沙箱里 npx vitest 偶发无输出，直跑二进制更稳定）
rm -rf dist && npx vite build
```
