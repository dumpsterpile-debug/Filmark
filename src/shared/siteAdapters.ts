/**
 * 站点适配器注册表（纯函数，主进程与渲染层共用，无 Node / DOM 依赖）。
 *
 * 以 scripts/ph-downloader.js（MagicPH）的 @match 域名与站点分支为参照，把
 * 「哪些站点可提取、用哪种策略提取、哪些媒体域名可放行」收敛为单一数据源，
 * 供 BrowserPolicy 白名单与渲染层面板共同消费。
 */

import { hostMatches, normalizeHost } from "./safeUrl";

/** 提取策略：generic 覆盖脚本里的多数站点，另外两个为专属解析 */
export type ExtractStrategyId = "generic" | "pornhub" | "xhamster";

/** progressive = 可直接下载的直链；hls = .m3u8 播放列表（本期仅复制/外部打开） */
export type SourceKind = "progressive" | "hls";

export interface ExtractedSource {
  url: string;
  label: string;
  kind: SourceKind;
  quality?: string;
  /** 直链需要自定义请求头（如 Referer），downloadURL 无法携带 -> 仅提供复制/外部打开 */
  headersRequired?: boolean;
}

export interface ExtractResult {
  adapterId: ExtractStrategyId;
  pageUrl: string;
  title: string;
  artist?: string;
  tags?: string[];
  poster?: string;
  sources: ExtractedSource[];
}

export interface SiteAdapter {
  /** 注册表键，仅用于标识 */
  id: string;
  label: string;
  /** 页面域名（精确或点后缀匹配） */
  hosts: string[];
  /** 直链媒体 CDN 域名：用于 new-window / will-navigate 下载拦截的白名单 */
  mediaHosts?: string[];
  /**
   * 提取策略；`null` 表示只登记域名策略、不在浏览器里显示提取面板
   * （iwara 有自己的一等下载 UI，不需要提取面板）。
   */
  strategy: ExtractStrategyId | null;
}

/** 挂了提取策略的适配器：`strategy` 必非空 */
export type ExtractAdapter = SiteAdapter & { strategy: ExtractStrategyId };

/**
 * 顺序即优先级：专属适配器在前，generic 兜底；各适配器域名互不重叠，
 * 因此匹配结果唯一，首个命中即返回。
 *
 * 这是「哪些站点受支持」的唯一数据源 —— 策略白名单不再内置任何站点默认值。
 */
export const SITE_ADAPTERS: readonly SiteAdapter[] = [
  {
    id: "pornhub",
    label: "Pornhub",
    hosts: ["pornhub.com", "pornhubpremium.com"],
    mediaHosts: ["phncdn.com"],
    strategy: "pornhub",
  },
  {
    id: "xhamster",
    label: "xHamster",
    hosts: ["xhamster.com"],
    mediaHosts: ["xhcdn.com"],
    strategy: "xhamster",
  },
  {
    id: "generic",
    label: "Generic",
    hosts: [
      "spankbang.com",
      "sxyprn.com",
      "hqporner.com",
      "beeg.com",
      "91porn.com",
      "xnxx.com",
      "xvideos.com",
      "porntrex.com",
      "analdin.com",
      "porn00.org",
      "redtube.com",
      "youporn.com",
      "youporngay.com",
      "tube8.com",
      "thumbzilla.com",
    ],
    mediaHosts: ["xvideos-cdn.com", "sb-cdn.com", "sxyprn.net"],
    strategy: "generic",
  },
  {
    // 仅登记域名策略（封面 / 下载白名单），不挂提取面板
    id: "iwara",
    label: "Iwara",
    hosts: ["iwara.tv", "iwara.ai"],
    mediaHosts: ["iwara.tv", "iwara.ai"],
    strategy: null,
  },
];

/** 依据主机名（或完整 URL）选择适配器；无匹配返回 null */
export function matchAdapter(hostOrUrl: string | null | undefined): SiteAdapter | null {
  const host = normalizeHost(hostOrUrl);
  if (!host) return null;
  for (const adapter of SITE_ADAPTERS) {
    if (adapter.hosts.some((allowed) => hostMatches(host, allowed))) return adapter;
  }
  return null;
}

/** 仅匹配挂了提取面板的站点；用于浏览器侧渲染判定 */
export function matchExtractAdapter(hostOrUrl: string | null | undefined): ExtractAdapter | null {
  const adapter = matchAdapter(hostOrUrl);
  return adapter && adapter.strategy !== null ? (adapter as ExtractAdapter) : null;
}

/** 是否为已支持「提取」的站点（仅登记域名策略的站点返回 false） */
export function isSupportedHost(hostOrUrl: string | null | undefined): boolean {
  return matchExtractAdapter(hostOrUrl) !== null;
}

/**
 * 注册表登记的媒体域名集合 —— 全仓唯一的白名单来源。
 *
 * 封面拉取与下载拦截共用这一份白名单：两者的域名事实相同，拆成两份只会制造
 * 「存在两种白名单」的错觉（此前 collectCoverHosts / collectDownloadHosts
 * 正是同一实现的别名）。
 *
 * ⚠️ 只收 mediaHosts（CDN），**不要**把普通页面域名放进来：
 * BrowserPolicy.decideDownload 的调用方包括 webview 的 will-navigate，
 * 若页面域名被当作下载域名，站点内的普通链接跳转会被误判为下载而中断导航。
 * 例外是 iwara：它的下载与封面确实托管在自身域名（`www.iwara.tv/download`、
 * `i.iwara.tv`）上，故其 mediaHosts 就是自身域名，保持历史行为不变。
 * 页面内提取出的直链走 browser:download-from-webcontents，不经过该白名单。
 */
export function collectMediaHosts(): Set<string> {
  const out = new Set<string>();
  for (const adapter of SITE_ADAPTERS) {
    for (const host of adapter.mediaHosts ?? []) out.add(host);
  }
  return out;
}
