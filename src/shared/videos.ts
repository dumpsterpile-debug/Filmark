import type { Video } from "./types";

interface RawVideo {
  file?: unknown;
  thumbnail?: unknown;
  file_name?: unknown;
  title?: unknown;
  duration?: unknown;
  genre?: unknown;
  tags?: unknown;
  artist?: unknown;
  character?: unknown;
  file_creation_date?: unknown;
  file_last_modification_date?: unknown;
  file_extension?: unknown;
  [key: string]: unknown;
}

/**
 * 元数据来自磁盘 JSON，类型不可信：只接受原始类型。
 * 对象/数组/函数一律视作缺失 —— 否则 `String({})` 会把 "[object Object]" 写进
 * file / title，让一条坏记录看起来「可播放」。
 */
function toText(value: unknown): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : "";
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(toText).filter(Boolean);
  return [toText(value)].filter(Boolean);
}

export function normalizeVideos(raw: unknown): Video[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const r = (item ?? {}) as RawVideo;
    const file = toText(r.file);
    return {
      id: file || `video-${index}`,
      file,
      playable: Boolean(file),
      thumbnail: toText(r.thumbnail),
      title: toText(r.file_name ?? r.title ?? r.file) || `视频 ${index + 1}`,
      durationMs: Number(r.duration) || 0,
      genre: toText(r.genre),
      tags: toStringList(r.tags),
      artist: toStringList(r.artist),
      character: toStringList(r.character),
      created: toText(r.file_creation_date),
      modified: toText(r.file_last_modification_date),
      extension: toText(r.file_extension),
    };
  });
}
