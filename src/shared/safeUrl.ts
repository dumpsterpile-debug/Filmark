/**
 * 纯 URL / 主机名校验（主进程与渲染层共用，无 Node 依赖）。
 *
 * `hostMatches` 是全仓唯一的 host 匹配实现：策略（browserPolicy）、
 * 站点注册表（siteAdapters）与封面拉取（safeUrl）都调用它，
 * 不得在别处再写一份点后缀判断。
 */

/**
 * 归一化主机名：接受裸主机、带端口、带路径或完整 URL，返回小写主机（去掉端口与尾点）。
 * 解析失败时回退为「去掉路径/端口的首个片段」，保证不会因抛错中断策略判定。
 */
export function normalizeHost(value: string | null | undefined): string {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  let host = raw;
  try {
    host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
  } catch {
    host = raw.split("/")[0] ?? "";
  }
  return host.replace(/^\[/, "").replace(/\]$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
}

/** 精确匹配或点后缀匹配（`cdn.example.com` 命中 `example.com`，但 `notexample.com` 不命中） */
export function hostMatches(host: string | null | undefined, allowed: string): boolean {
  const h = normalizeHost(host);
  const a = normalizeHost(allowed);
  if (!h || !a) return false;
  return h === a || h.endsWith("." + a);
}

/** 仅允许 http(s) 且主机在 allowlist（含子域名）内的 URL；默认拒绝回环/私网地址 */
export function safeUrl(input: string, allowHosts: ReadonlySet<string>): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (isPrivateOrLoopbackHost(host)) return null;
  const allowed = [...allowHosts].some((h) => hostMatches(host, h));
  return allowed ? url.toString() : null;
}

/** 仅允许 http(s) 作为外部打开的目标协议 */
export function isSafeExternalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isPrivateOrLoopbackHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h === "::1") return true;
  return (
    h.startsWith("127.") ||
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    h.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}
