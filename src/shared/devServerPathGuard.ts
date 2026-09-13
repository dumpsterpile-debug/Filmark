/**
 * Windows 路径别名（NTFS 备用数据流 / 8.3 短名）检测。
 *
 * Vite 的 `server.fs.deny` 只比对请求路径的字面量，而 Windows 会把
 * `/.env::$DATA` 解析为 `.env` 的默认数据流、把 `ENV~1` 解析为 8.3 短名，
 * 于是这两个形态都能绕过 deny 规则读到敏感文件
 * （GHSA-fx2h-pf6j-xcff / CVE-2026-53571，已修复于 Vite 6.4.3 / 7.3.5 / 8.0.16）。
 *
 * 这里是纯字符串判定，不依赖平台；由 `electron.vite.config.ts` 的 dev 中间件
 * 在 Windows 上启用，作为与 Vite 版本无关的第二道防线。
 */
const WINDOWS_PATH_ALIAS_RE = /::|~\d/;

/**
 * URL 是否含 Windows 路径别名形态。
 *
 * - `::` —— NTFS 备用数据流（`/.env::$DATA?raw`）
 * - `~` + 数字 —— 8.3 短名（`/ENV~1`）
 *
 * 单独的 `~`（如 `/~user/notes.md`）不会被判定，避免误伤合法路径。
 */
export function hasWindowsPathAlias(url: string): boolean {
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    // 非法百分号转义：退回原始串判断，不因解码失败而中断请求
  }
  return WINDOWS_PATH_ALIAS_RE.test(decoded);
}
