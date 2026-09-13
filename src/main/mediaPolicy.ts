/** media:// 协议允许的扩展名（视频/图片/音频），其余一律拒绝 */
export const MEDIA_EXTENSIONS = new Set([
  ".mp4",
  ".m4v",
  ".webm",
  ".mkv",
  ".mov",
  ".avi",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
  ".gif",
]);

export function isAllowedMediaPath(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return MEDIA_EXTENSIONS.has(ext);
}
