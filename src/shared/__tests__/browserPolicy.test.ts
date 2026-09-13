import { describe, expect, it } from "vitest";
import { BrowserPolicy, defaultBrowserPolicy } from "../browserPolicy";

describe("BrowserPolicy", () => {
  // 单一媒体白名单：封面拉取与下载拦截共用同一份 host 事实
  const policy = new BrowserPolicy({
    mediaHosts: new Set(["i.iwara.tv", "www.iwara.tv", "lynx.iwara.tv"]),
  });

  it("defaults to deny for external open", () => {
    expect(policy.decideExternal("file:///C:/x").action).toBe("deny");
    expect(policy.decideExternal("ms-settings:").action).toBe("deny");
    expect(policy.decideExternal("https://www.iwara.tv/").action).toBe("allow");
  });

  it("restricts cover fetch hosts", () => {
    expect(policy.decideFetch("http://127.0.0.1/x.jpg").action).toBe("deny");
    expect(policy.decideFetch("http://localhost:3000/x.jpg").action).toBe("deny");
    expect(policy.decideFetch("https://evil.example/x.jpg").action).toBe("deny");
    expect(policy.decideFetch("https://i.iwara.tv/x.jpg").action).toBe("allow");
    expect(policy.decideFetch("https://cdn.i.iwara.tv/x.jpg").action).toBe("allow");
  });

  it("restricts download hosts", () => {
    expect(policy.decideDownload("https://lynx.iwara.tv/download?download=a.mp4").action).toBe(
      "intercept"
    );
    expect(policy.decideDownload("https://evil.example/x").action).toBe("deny");
    expect(policy.decideDownload("not-a-url").action).toBe("deny");
  });

  it("denies non-http(s) download targets even on an allowlisted host", () => {
    // 旧实现只解析 hostname，ftp://lynx.iwara.tv/x 会被判为可拦截
    expect(policy.decideDownload("ftp://lynx.iwara.tv/x")).toEqual({
      action: "deny",
      reason: "scheme-not-allowed",
    });
    expect(policy.decideDownload("file:///C:/x.mp4").action).toBe("deny");
  });

  it("uses the same media allowlist for fetch and download", () => {
    const host = "https://i.iwara.tv/x.jpg";
    expect(policy.decideFetch(host).action).toBe("allow");
    expect(policy.decideDownload(host).action).toBe("intercept");
  });
});

describe("defaultBrowserPolicy", () => {
  const policy = defaultBrowserPolicy();

  it("serves iwara from the site adapter registry, not from hardcoded defaults", () => {
    expect(policy.decideFetch("https://i.iwara.tv/x.jpg").action).toBe("allow");
    expect(policy.decideDownload("https://lynx.iwara.tv/download?download=a.mp4").action).toBe(
      "intercept"
    );
  });

  it("allows media CDNs from the site adapter registry", () => {
    expect(policy.decideDownload("https://ev-h.phncdn.com/x/1080P.mp4").action).toBe("intercept");
    expect(policy.decideDownload("https://video.xhcdn.com/abc/720p.h264.mp4").action).toBe(
      "intercept"
    );
    expect(policy.decideFetch("https://thumb-nss.xhcdn.com/a.jpg").action).toBe("allow");
  });

  it("does not treat page hosts as downloads (would break in-site navigation)", () => {
    expect(policy.decideDownload("https://www.pornhub.com/view_video.php").action).toBe("deny");
    expect(policy.decideDownload("https://xhamster.com/videos/x").action).toBe("deny");
    expect(policy.decideDownload("https://spankbang.com/abc/video/x").action).toBe("deny");
  });

  it("still denies unknown hosts", () => {
    expect(policy.decideDownload("https://evil.example/x.mp4").action).toBe("deny");
    expect(policy.decideFetch("https://evil.example/x.jpg").action).toBe("deny");
  });
});
