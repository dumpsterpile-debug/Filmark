import type {
  ExtractResult,
  ExtractStrategyId,
  ExtractedSource,
  SourceKind,
} from "@shared/siteAdapters";
import { PAGE_HELPER_POOL, extractGeneric, extractPornhub, extractXhamster } from "./adapters";

/** webview 元素中本模块需要用到的最小接口 */
export interface ExtractWebview {
  executeJavaScript: (code: string) => Promise<unknown>;
}

export interface RunExtractionOptions {
  /** 页面数据常晚于 did-navigate 就绪，故轮询若干次 */
  attempts?: number;
  intervalMs?: number;
}

type StrategyFn = (doc: Document, url: string) => ExtractResult;

/**
 * 提取策略 → 实现。这是「策略」这一侧唯一的接线点；
 * 注册表（`SITE_ADAPTERS`）是另一侧，两者由
 * `__tests__/script.test.ts` 断言对齐：注册表里每个非 null 的 strategy
 * 都必须在此有实现。
 *
 * 注意：三个策略共用同一个 helper 池。不要为了「看起来对称」而给每个策略
 * 各写一份 helpers 列表 —— 内容完全相同，只会制造三个必须同步维护的副本。
 */
const STRATEGIES: Record<ExtractStrategyId, StrategyFn> = {
  generic: extractGeneric,
  pornhub: extractPornhub,
  xhamster: extractXhamster,
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 生成注入脚本：helper 与所选 extractor 都以源码文本拼接。
 * 使用 `toString()` 而非 import，是因为访客页无法访问本模块的模块作用域；
 * 若构建期做了压缩，函数名与其内部引用会被一致重命名，拼接后仍然自洽。
 */
export function buildExtractScript(strategy: ExtractStrategyId, url: string): string {
  const helpers = PAGE_HELPER_POOL.map((fn) => fn.toString()).join("\n");
  const extractor = STRATEGIES[strategy].toString();
  return [
    "(function () {",
    helpers,
    `var __extract = ${extractor};`,
    `return __extract(document, ${JSON.stringify(url)});`,
    "})()",
  ].join("\n");
}

/** 访客页返回值是不可信输入：逐字段校验后再交给 UI */
export function normalizeExtractResult(
  raw: unknown,
  strategy: ExtractStrategyId,
  fallbackUrl: string
): ExtractResult | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;

  const sources: ExtractedSource[] = [];
  const rawSources = Array.isArray(record.sources) ? record.sources : [];
  for (const item of rawSources) {
    if (!item || typeof item !== "object") continue;
    const source = item as Record<string, unknown>;
    const url = typeof source.url === "string" ? source.url.trim() : "";
    if (!/^https?:\/\//i.test(url)) continue;
    if (sources.some((existing) => existing.url === url)) continue;

    const kind: SourceKind = source.kind === "hls" ? "hls" : "progressive";
    const quality =
      typeof source.quality === "string" && source.quality ? source.quality : undefined;
    const label =
      typeof source.label === "string" && source.label ? source.label : (quality ?? kind);

    const next: ExtractedSource = { url, kind, label };
    if (quality) next.quality = quality;
    if (source.headersRequired === true) next.headersRequired = true;
    sources.push(next);
  }

  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === "string" && tag.length > 0)
    : [];
  const artist = typeof record.artist === "string" && record.artist ? record.artist : undefined;
  const poster = typeof record.poster === "string" && record.poster ? record.poster : undefined;

  return {
    adapterId: strategy,
    pageUrl: typeof record.pageUrl === "string" && record.pageUrl ? record.pageUrl : fallbackUrl,
    title: typeof record.title === "string" ? record.title : "",
    ...(artist ? { artist } : {}),
    tags,
    ...(poster ? { poster } : {}),
    sources,
  };
}

/**
 * 在访客页执行提取。返回最后一次可解析的结果（可能 sources 为空，用于展示「未找到媒体」），
 * 全部尝试都拿不到可解析对象时返回 null。
 */
export async function runExtraction(
  webview: ExtractWebview,
  strategy: ExtractStrategyId,
  url: string,
  options: RunExtractionOptions = {}
): Promise<ExtractResult | null> {
  const attempts = options.attempts ?? 8;
  const intervalMs = options.intervalMs ?? 300;
  const script = buildExtractScript(strategy, url);
  let last: ExtractResult | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let raw: unknown = null;
    try {
      raw = await webview.executeJavaScript(script);
    } catch {
      raw = null;
    }
    const parsed = normalizeExtractResult(raw, strategy, url);
    if (parsed) {
      last = parsed;
      if (parsed.sources.length > 0) return parsed;
    }
    if (attempt < attempts - 1) await delay(intervalMs);
  }

  return last;
}
