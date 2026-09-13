import type { ExtractResult, ExtractedSource, SourceKind } from "@shared/siteAdapters";

/**
 * 访客页内提取逻辑。
 *
 * ⚠️ 约束：这些函数会被 `Function.prototype.toString()` 序列化后注入 webview 访客页执行，
 * 因此**不得**引用模块作用域变量、不得 import 任何运行时依赖，只能使用参数与标准 DOM/URL API。
 * 序列化时 helper 会与所选 extractor 一起按声明顺序拼接，故彼此可以按名字相互调用。
 * 参考实现：scripts/ph-downloader.js（MagicPH）的 mediaFinder / getVidTitle / geekGifs / geekVideos。
 */

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-function-type */

/** 从 JSON-in-script 里把被转义的 `\/` 还原，并抽出 http(s) 媒体直链与 m3u8 */
function pageScanText(list: ExtractedSource[], text: unknown, base: string): void {
  if (typeof text !== "string" || !text) return;
  const clean = text.split("\\/").join("/");
  pageScanPattern(
    list,
    clean,
    base,
    /https?:\/\/[^\s"'<>\\),]+?\.mp4[^\s"'<>\\),]*/gi,
    "progressive"
  );
  pageScanPattern(list, clean, base, /https?:\/\/[^\s"'<>\\),]+?\.m3u8[^\s"'<>\\),]*/gi, "hls");
}

function pageScanPattern(
  list: ExtractedSource[],
  text: string,
  base: string,
  pattern: RegExp,
  kind: SourceKind
): void {
  const found = text.match(pattern);
  if (!found) return;
  for (let i = 0; i < found.length; i += 1) {
    const href = pageNormalizeUrl(found[i], base);
    if (!href) continue;
    const quality = pageQualityOf(href);
    pagePushSource(list, href, kind, pageLabel(kind, quality), quality);
  }
}

/** 扫描页面内 <script> 文本（与原脚本一致：只看脚本，避免整页 outerHTML 的开销） */
function pageScanScripts(doc: Document, list: ExtractedSource[], base: string): void {
  const scripts = doc.querySelectorAll("script");
  for (let i = 0; i < scripts.length; i += 1) {
    const text = scripts[i]?.textContent;
    if (!text || text.length < 12) continue;
    if (
      text.indexOf("mp4") === -1 &&
      text.indexOf("m3u8") === -1 &&
      text.indexOf("videoUrl") === -1
    ) {
      continue;
    }
    pageScanText(list, text, base);
  }
}

/** 同样的扫描，但只针对单个元素（如 xhamster 的 #initials-script） */
function pageScanElement(el: Element | null, list: ExtractedSource[], base: string): void {
  if (!el) return;
  pageScanText(list, el.textContent, base);
}

function pageNormalizeUrl(raw: unknown, base: string): string {
  if (typeof raw !== "string") return "";
  let value = raw.trim();
  if (!value) return "";
  if (value.indexOf("data:") === 0 || value.indexOf("blob:") === 0) return "";
  if (value.indexOf("//") === 0) value = "https:" + value;
  try {
    const resolved = new URL(value, base);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return "";
    return resolved.href;
  } catch {
    return "";
  }
}

function pageQualityOf(href: string): string {
  const match = /(\d{3,4})\s*[pP]/.exec(href);
  return match ? match[1] + "p" : "";
}

function pageLabel(kind: SourceKind, quality: string): string {
  if (kind === "hls") return quality ? quality + " HLS" : "HLS";
  return quality ? quality + " MP4" : "MP4";
}

function pagePushSource(
  list: ExtractedSource[],
  href: string,
  kind: SourceKind,
  label: string,
  quality: string,
  headersRequired?: boolean
): void {
  if (!href) return;
  for (let i = 0; i < list.length; i += 1) {
    const existing = list[i];
    if (existing && existing.url === href) return;
  }
  const item: ExtractedSource = { url: href, kind, label };
  if (quality) item.quality = quality;
  if (headersRequired) item.headersRequired = true;
  list.push(item);
}

function pageAddAttributeSource(list: ExtractedSource[], raw: unknown, base: string): void {
  const href = pageNormalizeUrl(raw, base);
  if (!href) return;
  const kind: SourceKind = /\.m3u8(\?|$|#)/i.test(href) ? "hls" : "progressive";
  const quality = pageQualityOf(href);
  pagePushSource(list, href, kind, pageLabel(kind, quality), quality);
}

function pageCollectVideoTags(doc: Document, list: ExtractedSource[], base: string): void {
  const videos = doc.querySelectorAll("video");
  for (let i = 0; i < videos.length; i += 1) {
    const video = videos[i];
    if (!video) continue;
    pageAddAttributeSource(list, video.getAttribute("src"), base);
    pageAddAttributeSource(list, video.getAttribute("data-src"), base);
    const children = video.querySelectorAll("source");
    for (let j = 0; j < children.length; j += 1) {
      const child = children[j];
      pageAddAttributeSource(list, child?.getAttribute("src"), base);
      pageAddAttributeSource(list, child?.getAttribute("data-src"), base);
    }
  }
}

function pageMetaContent(doc: Document, names: string[]): string {
  for (let i = 0; i < names.length; i += 1) {
    const el = doc.querySelector(
      'meta[property="' +
        names[i] +
        '"], meta[name="' +
        names[i] +
        '"], meta[itemprop="' +
        names[i] +
        '"]'
    );
    const content = el?.getAttribute("content");
    if (content) return content;
  }
  return "";
}

function pageText(el: Element | null): string {
  if (!el) return "";
  const text = el.textContent ?? "";
  return text.replace(/\s+/g, " ").trim();
}

function pagePickTitle(doc: Document): string {
  const meta = pageMetaContent(doc, ["og:title", "twitter:title"]);
  if (meta) return meta;
  const title = pageText(doc.querySelector("title"));
  if (title) return title;
  return typeof doc.title === "string" ? doc.title : "";
}

function pageFirstVideoPoster(doc: Document): string {
  const video = doc.querySelector("video[poster]");
  return video ? (video.getAttribute("poster") ?? "") : "";
}

function pageSplitTags(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw) return [];
  const parts = raw.split(",");
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const tag = (parts[i] ?? "").replace(/\s+/g, " ").trim();
    if (tag && out.indexOf(tag) === -1) out.push(tag);
  }
  return out;
}

function pageScriptMatch(doc: Document, pattern: RegExp): string {
  const scripts = doc.querySelectorAll("script");
  for (let i = 0; i < scripts.length; i += 1) {
    const text = scripts[i]?.textContent;
    if (!text) continue;
    const match = pattern.exec(text);
    if (match && match[1]) return match[1];
  }
  return "";
}

function pageJsonLdContentUrl(doc: Document): string {
  const blocks = doc.querySelectorAll('script[type="application/ld+json"]');
  for (let i = 0; i < blocks.length; i += 1) {
    const text = blocks[i]?.textContent;
    if (!text) continue;
    const match = /"contentUrl"\s*:\s*"([^"]+)"/.exec(text);
    if (match && match[1]) return match[1];
  }
  return "";
}

function pageJsonLdThumbnail(doc: Document): string {
  const blocks = doc.querySelectorAll('script[type="application/ld+json"]');
  for (let i = 0; i < blocks.length; i += 1) {
    const text = blocks[i]?.textContent;
    if (!text) continue;
    const match = /"thumbnailUrl"\s*:\s*"([^"]+)"/.exec(text);
    if (match && match[1]) return match[1];
  }
  return "";
}

/** progressive 优先，其次按分辨率从高到低 */
function pageSortSources(list: ExtractedSource[]): void {
  list.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "progressive" ? -1 : 1;
    const qa = parseInt(a.quality ?? "0", 10) || 0;
    const qb = parseInt(b.quality ?? "0", 10) || 0;
    return qb - qa;
  });
}

// ---------------------------------------------------------------------------
// 策略实现
// ---------------------------------------------------------------------------

/** 通用策略：覆盖脚本里 spankbang / 91porn / sxyprn / xnxx / xvideos / porntrex 等站点 */
export function extractGeneric(doc: Document, url: string): ExtractResult {
  const sources: ExtractedSource[] = [];
  pageCollectVideoTags(doc, sources, url);
  pageAddAttributeSource(
    sources,
    pageMetaContent(doc, [
      "og:video",
      "og:video:url",
      "og:video:secure_url",
      "twitter:player:stream",
    ]),
    url
  );
  pageAddAttributeSource(sources, pageJsonLdContentUrl(doc), url);
  pageScanScripts(doc, sources, url);
  pageSortSources(sources);
  return {
    adapterId: "generic",
    pageUrl: url,
    title: pagePickTitle(doc),
    tags: pageSplitTags(pageMetaContent(doc, ["keywords"])),
    poster:
      pageMetaContent(doc, ["og:image", "twitter:image"]) ||
      pageJsonLdThumbnail(doc) ||
      pageFirstVideoPoster(doc),
    sources,
  };
}

/** Pornhub 策略：解析内联 flashvars_* / mediaDefinitions / VIDEO_SHOW 中的字面量 URL */
export function extractPornhub(doc: Document, url: string): ExtractResult {
  const sources: ExtractedSource[] = [];
  pageScanScripts(doc, sources, url);
  pageCollectVideoTags(doc, sources, url);
  pageAddAttributeSource(
    sources,
    pageMetaContent(doc, ["og:video", "og:video:secure_url", "twitter:player:stream"]),
    url
  );
  pageSortSources(sources);
  const inlineTitle = pageScriptMatch(doc, /"video_title"\s*:\s*"([^"]+)"/);
  return {
    adapterId: "pornhub",
    pageUrl: url,
    title: inlineTitle || pagePickTitle(doc),
    tags: pageSplitTags(pageMetaContent(doc, ["keywords"])),
    poster: pageMetaContent(doc, ["og:image", "twitter:image"]),
    sources,
  };
}

/** xHamster 策略：数据在内联 #initials-script 的 JSON 里（h264 mp4 / hls） */
export function extractXhamster(doc: Document, url: string): ExtractResult {
  const sources: ExtractedSource[] = [];
  pageScanElement(doc.getElementById("initials-script"), sources, url);
  pageScanScripts(doc, sources, url);
  pageCollectVideoTags(doc, sources, url);
  pageSortSources(sources);
  const inlineTitle = pageScriptMatch(doc, /"titleLocalized"\s*:\s*"([^"]+)"/);
  return {
    adapterId: "xhamster",
    pageUrl: url,
    title: inlineTitle || pagePickTitle(doc),
    tags: pageSplitTags(pageMetaContent(doc, ["keywords"])),
    poster: pageMetaContent(doc, ["og:image", "twitter:image"]),
    sources,
  };
}

/**
 * 需要与所选 extractor 一起序列化注入的 helper 池。
 *
 * 顺序即拼接顺序：被调用的 helper 必须先于调用者声明（均为 function 声明，存在提升，顺序不敏感）。
 *
 * ⚠️ 这三条是硬约束，原理见 ADR-0004：
 * 1. 必须是具名 `function` 声明 —— 箭头常量序列化后不构成可调用声明；
 * 2. 不得引用模块作用域的任何值（导入、常量、闭包变量）；
 * 3. **新增一个 helper 必须同时加进本数组**，否则访客页会抛 ReferenceError，
 *    而类型检查与构建都不会失败。这条不变式由
 *    `__tests__/script.test.ts` 扫描本文件源码守住：任何模块级
 *    `function` 声明若不在本数组中，测试即失败。
 */
export const PAGE_HELPER_POOL: readonly Function[] = [
  pageScanText,
  pageScanPattern,
  pageScanScripts,
  pageScanElement,
  pageNormalizeUrl,
  pageQualityOf,
  pageLabel,
  pagePushSource,
  pageAddAttributeSource,
  pageCollectVideoTags,
  pageMetaContent,
  pageText,
  pagePickTitle,
  pageFirstVideoPoster,
  pageSplitTags,
  pageScriptMatch,
  pageJsonLdContentUrl,
  pageJsonLdThumbnail,
  pageSortSources,
];
