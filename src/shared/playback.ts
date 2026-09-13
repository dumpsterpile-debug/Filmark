const MIN_RESUME_SECONDS = 5;
const MIN_SAVE_SECONDS = 3;

/** 距结尾 > 5 秒且有实际进度时才提示续播 */
export function shouldResume(savedSeconds: number, durationSeconds: number): boolean {
  if (!savedSeconds || !durationSeconds) return false;
  return durationSeconds - savedSeconds > MIN_RESUME_SECONDS;
}

/** 合并进度记录：低于阈值（3 秒）的进度丢弃，避免误存刚打开的视频 */
export function mergeProgress(
  existing: Record<string, number>,
  updates: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = { ...existing };
  for (const [file, seconds] of Object.entries(updates)) {
    if (seconds >= MIN_SAVE_SECONDS) {
      out[file] = seconds;
    } else {
      delete out[file];
    }
  }
  return out;
}
