import { describe, expect, it } from "vitest";
import {
  SITE_ADAPTERS,
  collectMediaHosts,
  isSupportedHost,
  matchAdapter,
  matchExtractAdapter,
} from "../siteAdapters";

describe("matchAdapter", () => {
  it("matches dedicated adapters first", () => {
    expect(matchAdapter("https://www.pornhub.com/view_video.php")?.id).toBe("pornhub");
    expect(matchAdapter("pornhubpremium.com")?.id).toBe("pornhub");
    expect(matchAdapter("https://xhamster.com/videos/x")?.id).toBe("xhamster");
  });

  it("falls back to the generic adapter for the remaining hosts", () => {
    expect(matchAdapter("https://spankbang.com/abc/video/x")?.id).toBe("generic");
    expect(matchAdapter("https://www.xvideos.com/video123/x")?.id).toBe("generic");
    expect(matchAdapter("youporngay.com")?.id).toBe("generic");
  });

  it("matches iwara from the registry but exposes no extraction adapter", () => {
    // iwara 仍在注册表里（供应域名策略），只是不挂提取面板
    expect(matchAdapter("https://www.iwara.tv/video/abc")?.id).toBe("iwara");
    expect(matchAdapter("iwara.ai")?.id).toBe("iwara");
    expect(matchExtractAdapter("https://www.iwara.tv/video/abc")).toBeNull();
    expect(isSupportedHost("iwara.tv")).toBe(false);
    expect(matchExtractAdapter("https://spankbang.com/abc/video/x")?.id).toBe("generic");
  });

  it("returns null for unsupported or malformed input", () => {
    expect(matchAdapter("https://evil.example/x")).toBeNull();
    expect(matchAdapter("")).toBeNull();
    expect(matchExtractAdapter("https://evil.example/x")).toBeNull();
  });

  it("does not treat a spoofed suffix as supported", () => {
    expect(isSupportedHost("notpornhub.com")).toBe(false);
    expect(isSupportedHost("pornhub.com.evil.net")).toBe(false);
    expect(isSupportedHost("xhamster.com")).toBe(true);
  });
});

describe("SITE_ADAPTERS registry", () => {
  it("has unique ids and non-empty host lists", () => {
    const ids = SITE_ADAPTERS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const adapter of SITE_ADAPTERS) {
      expect(adapter.hosts.length).toBeGreaterThan(0);
    }
  });

  it("collects the media allowlist from media domains only", () => {
    const hosts = collectMediaHosts();
    expect(hosts.has("phncdn.com")).toBe(true);
    expect(hosts.has("xhcdn.com")).toBe(true);
    expect(hosts.has("xvideos-cdn.com")).toBe(true);
    // iwara 的下载/封面确实托管在自身域名上，故由注册表数据提供，而非硬编码默认
    expect(hosts.has("iwara.tv")).toBe(true);
    expect(hosts.has("iwara.ai")).toBe(true);
    // 提取型站点的页面域名不算媒体域名，否则 will-navigate 会把站内跳转误判为下载
    expect(hosts.has("pornhub.com")).toBe(false);
    expect(hosts.has("xhamster.com")).toBe(false);
    expect(hosts.has("spankbang.com")).toBe(false);
  });

  it("keeps every extraction adapter pointing at a real strategy", () => {
    for (const adapter of SITE_ADAPTERS) {
      const host = adapter.hosts[0];
      expect(host).toBeTruthy();
      if (adapter.strategy !== null && host) {
        expect(matchExtractAdapter(`https://${host}/`)?.strategy).toBe(adapter.strategy);
      }
    }
  });
});
