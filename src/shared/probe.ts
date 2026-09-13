/** 从 ffmpeg -i stderr 输出解析 Duration（HH:MM:SS.xx），失败返回 0 */
export function parseFfmpegDurationMs(stderr: string): number {
  const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) return 0;
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}
