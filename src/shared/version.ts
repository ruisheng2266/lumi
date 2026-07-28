/**
 * src/shared/version.ts
 * 单一版本来源：由 vite.config.ts 通过 __APP_VERSION__ 注入 package.json 的 version，
 * 这样 About 页、设置页、导出 JSON 都引用同一处，避免版本号漂移（审计 #1）。
 */

declare const __APP_VERSION__: string;

/** 应用版本号，例如 "0.2.0" —— 来自 package.json */
export const APP_VERSION: string = __APP_VERSION__;

/** 最后更新日期（与版本发布对应），集中维护避免散落硬编码 */
export const APP_LAST_UPDATED = '2026-07-28';
