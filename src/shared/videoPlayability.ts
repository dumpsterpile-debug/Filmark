import type { Video } from "./types";

export function isPlayableVideo(file: string): boolean {
  return Boolean(file);
}

/** 依据持久化的文件重定位映射回填 file 字段 */
export function applyFileRelocations(
  videos: Video[],
  relocations: Record<string, string>
): Video[] {
  return videos.map((v) => {
    const relocated = relocations[v.id];
    if (relocated) return { ...v, file: relocated };
    return v;
  });
}
