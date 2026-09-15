import type { ExtractResult } from "./siteAdapters";
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

/** 常见媒体扩展名：标题已经带了就不再多加一个 */
const MEDIA_EXTENSION = /\.(mp4|m4v|webm|mkv|mov|avi|flv|wmv|ts|mp3|m4a)$/i;

/**
 * 解析下载文件名与扩展名。
 * 优先级：download 查询参数 > 视频 id > `titleHint`（页面标题 / 站点提取结果）
 * > `fallbackName`（主进程给出的原始文件名）> URL 末段路径（媒体直链通常就是文件名）
 * > "download.mp4"。
 *
 * `titleHint` 排在原始文件名之前，是因为媒体直链的末段（`1080P_4000K_1.mp4` 这类
 * CDN 产物）对用户没有意义，而页面标题才是用户认得出的名字 —— 用户脚本里
 * `sanitizeTitle()` 起的就是这个作用。标题一般不带扩展名，故用直链的扩展名补上，
 * 否则落盘的会是一个没有扩展名的文件。
 */
export function parseDownloadFilename(
  href: string,
  pathname: string,
  fallbackName?: string,
  titleHint?: string
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
  if (!name && titleHint?.trim()) {
    const hint = titleHint.trim();
    name = MEDIA_EXTENSION.test(hint) ? hint : hint + urlExtensionSuffix(href);
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

/** URL 末段的扩展名（含点，如 ".mp4"）；取不到返回空串 */
function urlExtensionSuffix(href: string): string {
  try {
    const segments = new URL(href).pathname.split("/").filter(Boolean);
    const extension = splitFileName(
      decodeURIComponent(segments[segments.length - 1] ?? "")
    ).extension;
    return extension ? `.${extension}` : "";
  } catch {
    return "";
  }
}

/**
 * 合并「站点提取结果」与「页面抓取结果」，作为元数据弹窗的预填输入。
 *
 * 提取结果优先：它按站点策略解析，标题来自播放器配置（比 og:title 更干净）、封面与标签
 * 也更贴近真实内容，而且面板已经抓过一次。抓取结果负责补齐它没有的字段
 * （出演者、video_id、URL 等），因此两种来源任缺一个都仍然可用。
 */
export function mergeScrapedPage(
  scraped: ScrapedPage,
  media: ExtractResult | null | undefined
): ScrapedPage {
  if (!media) return scraped;
  const title = media.title.trim();
  const tags = (media.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
  const artist = (media.artist ?? "").trim();
  const poster = (media.poster ?? "").trim();
  return {
    ...scraped,
    title: title || scraped.title,
    tags: tags.length > 0 ? tags : scraped.tags,
    artist: artist ? [artist] : scraped.artist,
    posterStyle: poster ? `url("${poster}")` : scraped.posterStyle,
  };
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
