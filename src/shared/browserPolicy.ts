import { hostMatches, isSafeExternalUrl, safeUrl } from "./safeUrl";
import { collectMediaHosts } from "./siteAdapters";

export type PolicyDecision = { action: "allow" | "deny" | "intercept"; reason: string };

export interface BrowserPolicyOptions {
  /**
   * 媒体域名白名单。封面拉取与下载拦截共用同一份 —— 见 CONTEXT.md「媒体域名」
   * 与 ADR-0003：两者的域名事实相同，拆成两个字段只会让白名单看起来有两份。
   */
  mediaHosts: ReadonlySet<string>;
}

/**
 * persist:browser 会话的外部效应策略：导航下载、外部打开、封面拉取统一裁决。
 * 主进程强制执行；渲染层复用同一实例保证 UX 与主进程一致。
 */
export class BrowserPolicy {
  constructor(private readonly opts: BrowserPolicyOptions) {}

  decideExternal(url: string): PolicyDecision {
    return isSafeExternalUrl(url)
      ? { action: "allow", reason: "safe-http" }
      : { action: "deny", reason: "scheme-not-allowed" };
  }

  decideFetch(url: string): PolicyDecision {
    return safeUrl(url, this.opts.mediaHosts)
      ? { action: "allow", reason: "media-host-allowed" }
      : { action: "deny", reason: "host-not-allowed" };
  }

  decideDownload(url: string): PolicyDecision {
    // 先卡协议：downloadURL 只接受 http(s)，非 http(s) 不得成为拦截目标
    if (!isSafeExternalUrl(url)) return { action: "deny", reason: "scheme-not-allowed" };
    // host 匹配走唯一实现，不再自带点后缀判断
    const allowed = [...this.opts.mediaHosts].some((host) => hostMatches(url, host));
    return allowed
      ? { action: "intercept", reason: "media-host" }
      : { action: "deny", reason: "media-host-not-allowed" };
  }
}

/** 默认策略：完全由站点适配器注册表（媒体 CDN 域名）驱动，不内置任何站点默认值 */
export function defaultBrowserPolicy(): BrowserPolicy {
  return new BrowserPolicy({ mediaHosts: collectMediaHosts() });
}
