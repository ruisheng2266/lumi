import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

// jsdom 环境的 globalThis.crypto 可能缺少 subtle；用 Node 的 WebCrypto 兜底，确保同步加密层可测
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  globalThis.crypto = webcrypto as unknown as Crypto;
}