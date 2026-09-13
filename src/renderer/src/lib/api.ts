import type { MediaApi } from "@shared/types";

/**
 * 渲染层与桌面端之间的唯一端口读取点。
 *
 * 生产环境返回 preload 暴露的 `window.api`；测试用 `setApi()` 注入内存实现
 * （`src/renderer/src/test/fakeApi.ts`）。除这里之外，渲染层不应再直接读写 `window.api` ——
 * 换一次实现只改这一个文件，而不是散落在各个调用点。
 */
let injected: MediaApi | null = null;

/** 仅测试使用：注入替代端口；传 null 恢复读取 `window.api` */
export function setApi(api: MediaApi | null): void {
  injected = api;
}

/** 当前可用的桌面端口；不在 Electron 环境（或测试未注入）时为 null */
export function getApi(): MediaApi | null {
  if (injected) return injected;
  if (typeof window === "undefined") return null;
  return (window.api as MediaApi | undefined) ?? null;
}
