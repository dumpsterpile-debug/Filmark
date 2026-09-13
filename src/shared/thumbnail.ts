/** 轻量字符串哈希（FNV-1a），生成稳定 16 进制标识，避免依赖 node crypto */
function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** 缩略图缓存路径：视频路径哈希 + .jpg */
export function thumbnailCachePath(videoPath: string, cacheDir: string): string {
  const hash = hashString(videoPath);
  return `${cacheDir.replace(/[\\/]+$/, "")}/${hash}.jpg`;
}

/** 截帧时刻：约视频 1/8 处 */
export function thumbnailSeekMs(durationMs: number): number {
  return Math.floor(durationMs / 8);
}
