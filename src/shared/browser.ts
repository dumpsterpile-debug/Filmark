/** 仅接受 http(s) 协议的 URL */
export function isValidHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** 归一化默认网页：合法且去除首尾空白；否则回退内置默认页 */
export function normalizeWebUrl(saved: string | null | undefined, fallback: string): string {
  if (saved && isValidHttpUrl(saved)) return saved.trim();
  return fallback;
}

/** 解析下载目录：配置路径优先，否则回退系统下载目录 */
export function resolveDownloadDir(
  configured: string | null | undefined,
  systemDownloads: string
): string {
  const trimmed = configured?.trim();
  return trimmed ? trimmed : systemDownloads;
}
