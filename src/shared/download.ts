import type { DownloadMeta, DownloadRequest } from "./types";

export interface ScrapedPage {
  artist: string[];
  tags: string[];
  title: string;
  videoId: string;
  url: string;
  fileName: string;
  extension: string;
  posterStyle: string;
}

export type { DownloadMeta, DownloadRequest };

/** 清洗文件名中的 Windows 非法字符；空值回退 "download" */
export function sanitizeFileName(name: string): string {
  const cleaned = String(name)
    .replace(/[\\/:*?"<>|]+/g, "_")
    .trim();
  return cleaned || "download";
}

/** 判断是否为站点的直接下载链接：路径为 /download 且带 download 查询参数 */
export function isDownloadUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return path === "/download" && Boolean(u.searchParams.get("download"));
  } catch {
    return false;
  }
}

/** 从页面路径解析 video_id（`/video/<id>` 形式） */
export function parseVideoId(pathname: string): string {
  const m = /\/video\/([^/]+)/.exec(pathname);
  return m?.[1] ?? "";
}

/**
 * 解析下载文件名与扩展名。
 * 优先级：download 查询参数 > 视频 id > `fallbackName`（主进程给出的原始文件名）
 * > URL 末段路径（媒体直链通常就是文件名）> "download.mp4"。
 */
export function parseDownloadFilename(
  href: string,
  pathname: string,
  fallbackName?: string
): { fileName: string; baseName: string; extension: string } {
  let name = "";
  try {
    const u = new URL(href);
    const download = u.searchParams.get("download");
    if (download) name = download;
  } catch {
    /* 忽略解析失败 */
  }
  if (!name) {
    const id = parseVideoId(pathname);
    if (id) name = `${id}.mp4`;
  }
  if (!name && fallbackName?.trim()) name = fallbackName.trim();
  if (!name) {
    try {
      const segments = new URL(href).pathname.split("/").filter(Boolean);
      name = decodeURIComponent(segments[segments.length - 1] ?? "");
    } catch {
      name = "";
    }
  }
  if (!name) name = "download.mp4";
  const split = splitFileName(name);
  return { fileName: sanitizeFileName(name), ...split };
}

export function splitFileName(fileName: string): { baseName: string; extension: string } {
  const extMatch = fileName.match(/\.([^.]+)$/);
  const extension = extMatch?.[1] ? extMatch[1].toLowerCase() : "";
  const baseName = extension ? fileName.slice(0, -(extension.length + 1)) : fileName;
  return { baseName, extension };
}

/** 依据页面抓取数据与 artist 记忆生成预填充的元数据 */
export function scrapeToMeta(input: {
  scraped: ScrapedPage;
  request: DownloadRequest;
  prefs: { genre?: string; character?: string } | undefined;
}): DownloadMeta {
  const fileName = sanitizeFileName(input.scraped.fileName || input.request.fileName);
  const { baseName, extension } = splitFileName(fileName);
  return {
    file: "",
    thumbnail: "",
    title: input.scraped.title || baseName,
    durationMs: 0,
    genre: input.prefs?.genre ?? "",
    tags: input.scraped.tags,
    artist: input.scraped.artist,
    character: input.prefs?.character ? [input.prefs.character] : [],
    created: "",
    modified: "",
    extension,
    video_id: input.scraped.videoId,
    url: input.scraped.url || input.request.url,
    thumbnailUrl: input.scraped.posterStyle,
    file_name: baseName,
    file_extension: extension,
  };
}
