import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractResult, ExtractStrategyId } from "@shared/siteAdapters";
import { extractGeneric, extractPornhub, extractXhamster } from "../adapters";
import { buildExtractScript, normalizeExtractResult, runExtraction } from "../index";

const GENERIC_HTML = `
<html><head>
<title>Fallback Title</title>
<meta property="og:title" content="Generic Title" />
<meta property="og:image" content="https://cdn.example/cover.jpg" />
<meta name="keywords" content="tag one, tag two, tag one" />
<script type="application/ld+json">{"contentUrl":"https://cdn.example/video-720p.mp4","thumbnailUrl":"https://cdn.example/thumb.jpg"}</script>
</head><body>
<video poster="https://cdn.example/poster.jpg">
  <source src="https://cdn.example/stream-1080p.mp4" />
  <source src="https://cdn.example/stream.m3u8" />
</video>
<script>var mediaDefinitions=[{"videoUrl":"https:\\/\\/cdn.example\\/direct-480p.mp4"}];</script>
</body></html>
`;

const PORNHUB_HTML = `
<html><head><title>PH</title></head><body>
<script>
var flashvars_123 = {"video_title":"PH Title","mediaDefinitions":[
 {"format":"mp4","videoUrl":"https:\\/\\/ev-h.phncdn.com\\/videos\\/abc\\/1080P_4000K_1.mp4"},
 {"format":"hls","videoUrl":"https:\\/\\/ev-h.phncdn.com\\/videos\\/abc\\/master.m3u8"}]};
</script>
</body></html>
`;

/** flashvars 带 remote 分辨率清单的形态（用户脚本正是靠它拿到全部分辨率） */
const PORNHUB_REMOTE_HTML = `
<html><head><title>PH</title></head><body>
<script>
var flashvars_123 = {"video_title":"PH Remote","image_url":"\\/\\/ci.phncdn.com\\/videos\\/abc\\/1.jpg","mediaDefinitions":[
 {"format":"mp4","videoUrl":"https:\\/\\/ev-h.phncdn.com\\/videos\\/abc\\/preview_240p.mp4"},
 {"remote":true,"videoUrl":"https:\\/\\/ev-h.phncdn.com\\/videos\\/abc\\/master.json"}]};
</script>
</body></html>
`;

const XHAMSTER_HTML = `
<html><head><title>XH</title></head><body>
<script id="initials-script">
{"titleLocalized":"XH Title","h264":[{"url":"https:\\/\\/video.xhcdn.com\\/abc\\/720p.h264.mp4"}],
 "mp4":{"1080":{"url":"https:\\/\\/video.xhcdn.com\\/abc\\/1080p.h264.mp4"}},
 "hls":"https:\\/\\/video.xhcdn.com\\/abc\\/master.m3u8"}
</script>
</body></html>
`;

function parseHtml(html: string): Document {
  const doc = document.implementation.createHTMLDocument("fixture");
  doc.documentElement.innerHTML = html;
  return doc;
}

/** remote 分辨率清单端点的固定响应 */
const QUALITY_LIST = [
  { quality: "1080", format: "mp4", videoUrl: "https://ev-h.phncdn.com/videos/abc/1080P.mp4" },
  { quality: "720", format: "mp4", videoUrl: "https://ev-h.phncdn.com/videos/abc/720P.mp4" },
  { quality: "auto", format: "hls", videoUrl: "https://ev-h.phncdn.com/videos/abc/master.m3u8" },
];

/** 被拉取的清单地址 */
const requested: string[] = [];

class FakeXhr {
  status = 200;
  responseText = JSON.stringify(QUALITY_LIST);
  open(_method: string, requestUrl: string): void {
    requested.push(requestUrl);
  }
  send(): void {
    /* 上面那份固定响应 */
  }
}

function runInjectedScript(strategy: ExtractStrategyId, url: string): ExtractResult {
  const script = buildExtractScript(strategy, url);
  // 用 Function 而非 eval：模拟注入到访客页全局作用域执行（那正是这个规则想防住的语义，此处是有意豁免）
  // oxlint-disable-next-line typescript/no-implied-eval
  return new Function(`return ${script}`)() as ExtractResult;
}

beforeEach(() => {
  // 提取会在访客页上下文里同步 XHR 拉分辨率清单；这里换成固定响应，顺带钉住「到底拉了什么」
  requested.length = 0;
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("extractGeneric", () => {
  const url = "https://spankbang.com/abc/video/x";
  const result = extractGeneric(parseHtml(GENERIC_HTML), url);

  it("picks the page title, poster and de-duplicated tags", () => {
    expect(result.title).toBe("Generic Title");
    expect(result.poster).toBe("https://cdn.example/cover.jpg");
    expect(result.tags).toEqual(["tag one", "tag two"]);
    expect(result.adapterId).toBe("generic");
    expect(result.pageUrl).toBe(url);
  });

  it("collects progressive sources from <source>, JSON-LD and inline scripts", () => {
    const urls = result.sources.map((s) => s.url);
    expect(urls).toContain("https://cdn.example/stream-1080p.mp4");
    expect(urls).toContain("https://cdn.example/video-720p.mp4");
    expect(urls).toContain("https://cdn.example/direct-480p.mp4");
  });

  it("tags the m3u8 as hls and sorts progressive first, then by quality", () => {
    const hls = result.sources.filter((s) => s.kind === "hls");
    expect(hls.map((s) => s.url)).toEqual(["https://cdn.example/stream.m3u8"]);

    const firstHlsIndex = result.sources.findIndex((s) => s.kind === "hls");
    const lastProgressiveIndex = result.sources.map((s) => s.kind).lastIndexOf("progressive");
    expect(lastProgressiveIndex).toBeLessThan(firstHlsIndex);
    expect(result.sources[0]?.quality).toBe("1080p");
  });
});

describe("extractPornhub", () => {
  const url = "https://www.pornhub.com/view_video.php?viewkey=abc";
  const result = extractPornhub(parseHtml(PORNHUB_HTML), url);

  it("reads the inline video_title", () => {
    expect(result.title).toBe("PH Title");
    expect(result.adapterId).toBe("pornhub");
  });

  it("extracts both progressive and hls sources from flashvars", () => {
    const progressive = result.sources.filter((s) => s.kind === "progressive");
    expect(progressive.map((s) => s.url)).toEqual([
      "https://ev-h.phncdn.com/videos/abc/1080P_4000K_1.mp4",
    ]);
    expect(progressive[0]?.quality).toBe("1080p");
    expect(result.sources.some((s) => s.kind === "hls")).toBe(true);
  });

  it("does not hit the network when no remote endpoint is advertised", () => {
    // 页面没有 remote 端点时不发同步 XHR —— 提取会被轮询多次，白拉一次很贵
    expect(requested).toEqual([]);
  });
});

describe("extractPornhub remote quality list", () => {
  const url = "https://www.pornhub.com/view_video.php?viewkey=abc";

  it("pulls every resolution from the remote endpoint", () => {
    const result = extractPornhub(parseHtml(PORNHUB_REMOTE_HTML), url);
    const progressive = result.sources.filter((s) => s.kind === "progressive");

    // 行内那条直链仍然保留；清单里的分辨率按高低排在其后
    expect(progressive.map((s) => s.url)).toEqual([
      "https://ev-h.phncdn.com/videos/abc/1080P.mp4",
      "https://ev-h.phncdn.com/videos/abc/720P.mp4",
      "https://ev-h.phncdn.com/videos/abc/preview_240p.mp4",
    ]);
    expect(progressive.map((s) => s.quality)).toEqual(["1080p", "720p", "240p"]);
    expect(progressive[0]?.label).toBe("1080p MP4");

    const hls = result.sources.filter((s) => s.kind === "hls");
    expect(hls.map((s) => s.url)).toEqual(["https://ev-h.phncdn.com/videos/abc/master.m3u8"]);

    // 清单端点只在页面上下文里拉一次，且用的是页面给出的地址
    expect(requested).toEqual(["https://ev-h.phncdn.com/videos/abc/master.json"]);
  });

  it("reads the poster from the flashvars image_url", () => {
    const result = extractPornhub(parseHtml(PORNHUB_REMOTE_HTML), url);
    expect(result.poster).toBe("https://ci.phncdn.com/videos/abc/1.jpg");
    expect(result.title).toBe("PH Remote");
  });

  it("falls back to inline literals when the endpoint is unreachable", () => {
    vi.stubGlobal("XMLHttpRequest", undefined);
    const result = extractPornhub(parseHtml(PORNHUB_REMOTE_HTML), url);
    expect(result.sources.map((s) => s.url)).toEqual([
      "https://ev-h.phncdn.com/videos/abc/preview_240p.mp4",
    ]);
  });
});

describe("extractXhamster", () => {
  const url = "https://xhamster.com/videos/x";
  const result = extractXhamster(parseHtml(XHAMSTER_HTML), url);

  it("reads titleLocalized and the initials-script media URLs", () => {
    expect(result.title).toBe("XH Title");
    const progressive = result.sources.filter((s) => s.kind === "progressive");
    expect(progressive.map((s) => s.quality)).toEqual(["1080p", "720p"]);
    expect(result.sources.some((s) => s.kind === "hls")).toBe(true);
  });
});

describe("buildExtractScript", () => {
  it("produces a self-contained script that runs in page scope", () => {
    document.documentElement.innerHTML = GENERIC_HTML;
    const result = runInjectedScript("generic", "https://spankbang.com/abc/video/x");

    expect(result.title).toBe("Generic Title");
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.sources.every((s) => s.url.startsWith("https://"))).toBe(true);
  });

  it("resolves relative URLs against the supplied page URL", () => {
    document.documentElement.innerHTML =
      '<html><body><video><source src="/media/rel-360p.mp4" /></video></body></html>';
    const result = runInjectedScript("generic", "https://example.org/watch/1");

    expect(result.sources.map((s) => s.url)).toEqual(["https://example.org/media/rel-360p.mp4"]);
  });
});

describe("normalizeExtractResult", () => {
  it("rejects non-object payloads", () => {
    expect(normalizeExtractResult(null, "generic", "u")).toBeNull();
    expect(normalizeExtractResult("nope", "generic", "u")).toBeNull();
    expect(normalizeExtractResult(42, "generic", "u")).toBeNull();
  });

  it("drops unsafe urls, de-duplicates and coerces fields", () => {
    const result = normalizeExtractResult(
      {
        pageUrl: "https://spankbang.com/x",
        title: 123,
        tags: ["ok", "", 5],
        poster: 7,
        sources: [
          { url: "https://cdn.example/a.mp4", kind: "weird", label: 9 },
          { url: "https://cdn.example/a.mp4", kind: "progressive" },
          { url: "javascript:alert(1)" },
          { url: "blob:https://cdn.example/x" },
          { url: "https://cdn.example/b.m3u8", kind: "hls", quality: "720p" },
          null,
        ],
      },
      "generic",
      "https://fallback.example/p"
    );

    expect(result?.title).toBe("");
    expect(result?.tags).toEqual(["ok"]);
    expect(result?.sources).toHaveLength(2);
    expect(result?.sources[0]).toEqual({
      url: "https://cdn.example/a.mp4",
      kind: "progressive",
      label: "progressive",
    });
    expect(result?.sources[1]).toEqual({
      url: "https://cdn.example/b.m3u8",
      kind: "hls",
      label: "720p",
      quality: "720p",
    });
    expect(result?.poster).toBeUndefined();
  });

  it("falls back to the supplied page url when the payload omits it", () => {
    const result = normalizeExtractResult({ sources: [] }, "pornhub", "https://ph.example/v");
    expect(result?.pageUrl).toBe("https://ph.example/v");
    expect(result?.adapterId).toBe("pornhub");
  });
});

describe("runExtraction", () => {
  const payload: ExtractResult = {
    adapterId: "generic",
    pageUrl: "https://spankbang.com/x",
    title: "T",
    tags: [],
    sources: [{ url: "https://cdn.example/a.mp4", kind: "progressive", label: "MP4" }],
  };

  it("returns the first result that contains sources", async () => {
    const executeJavaScript = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(payload);
    const result = await runExtraction(
      { executeJavaScript },
      "generic",
      "https://spankbang.com/x",
      { attempts: 3, intervalMs: 0 }
    );

    expect(result?.sources).toHaveLength(1);
    expect(executeJavaScript).toHaveBeenCalledTimes(2);
  });

  it("keeps the last parseable result when no sources are found", async () => {
    const executeJavaScript = vi.fn().mockResolvedValue({ title: "Empty", sources: [], tags: [] });
    const result = await runExtraction(
      { executeJavaScript },
      "generic",
      "https://spankbang.com/x",
      { attempts: 2, intervalMs: 0 }
    );

    expect(result?.title).toBe("Empty");
    expect(result?.sources).toEqual([]);
    expect(executeJavaScript).toHaveBeenCalledTimes(2);
  });

  it("returns null when the guest never yields a parseable payload", async () => {
    const executeJavaScript = vi.fn().mockRejectedValue(new Error("nope"));
    const result = await runExtraction(
      { executeJavaScript },
      "generic",
      "https://spankbang.com/x",
      { attempts: 2, intervalMs: 0 }
    );

    expect(result).toBeNull();
  });
});
