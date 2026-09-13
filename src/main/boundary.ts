import { relative, resolve } from "path";
import { isSafeExternalUrl, safeUrl } from "@shared/safeUrl";

export { isSafeExternalUrl, safeUrl };

/** 主进程安全边界：路径、URL、发送方校验的统一入口。 */

export interface IpcSenderLike {
  senderFrame?: { url?: string } | null;
}

/**
 * 校验 IPC 调用方属于允许的应用来源（file:// 打包页或开发 URL）。
 * 返回 true 才允许继续处理敏感载荷。
 */
export function assertTrustedSender(
  event: IpcSenderLike,
  allowedOrigins: ReadonlySet<string>
): boolean {
  const url = event.senderFrame?.url;
  if (!url) return false;
  // file:// 页面的 URL.origin 是 "null"，按前缀直接匹配
  if (url.startsWith("file://")) return allowedOrigins.has("file://");
  try {
    return allowedOrigins.has(new URL(url).origin);
  } catch {
    return false;
  }
}

/** 应用自身可信来源；开发模式由 ELECTRON_RENDERER_URL 提供 */
export function appOrigins(): Set<string> {
  const origins = new Set<string>(["file://"]);
  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    try {
      origins.add(new URL(devUrl).origin);
    } catch {
      /* 忽略非法开发 URL */
    }
  }
  return origins;
}

/**
 * 把 input 解析为 root 内的绝对路径；越界或等于 root 返回 null。
 * 拒绝符号链接逃逸与绝对路径覆盖。
 */
export function safeResolve(root: string, input: string): string | null {
  const rootAbs = resolve(root);
  let target: string;
  try {
    target = resolve(rootAbs, input);
  } catch {
    return null;
  }
  const rel = relative(rootAbs, target);
  if (
    rel === "" ||
    rel === ".." ||
    rel.startsWith(".." + String.fromCharCode(92)) ||
    rel.startsWith("../")
  ) {
    return null;
  }
  return target;
}

/**
 * 判断 target 绝对路径是否严格位于 root 目录内（目录边界比较，非前缀比较）。
 * 用于删除等必须以目录为边界的能力。
 */
export function isPathInside(root: string, target: string): boolean {
  const rootAbs = resolve(root);
  const targetAbs = resolve(target);
  const rel = relative(rootAbs, targetAbs);
  return (
    rel !== "" &&
    rel !== ".." &&
    !rel.startsWith(".." + String.fromCharCode(92)) &&
    !rel.startsWith("../")
  );
}
