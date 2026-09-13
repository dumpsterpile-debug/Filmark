import { describe, expect, it } from "vitest";
import {
  isDownloadUrl,
  parseDownloadFilename,
  parseVideoId,
  sanitizeFileName,
  scrapeToMeta,
  splitFileName,
} from "../download";

describe("sanitizeFileName", () => {
  it("replaces illegal windows characters", () => {
    expect(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe("a_b_c_d_e_f_g_h_i_j");
  });

  it("trims whitespace and falls back to a default", () => {
    expect(sanitizeFileName("  ")).toBe("download");
    expect(sanitizeFileName("")).toBe("download");
  });
});

describe("parseVideoId", () => {
  it("extracts the id from an iwara video path", () => {
    expect(parseVideoId("/video/zkgwZnoNtSwgd2/echo")).toBe("zkgwZnoNtSwgd2");
  });

  it("returns empty string when no video id is present", () => {
    expect(parseVideoId("/")).toBe("");
  });
});

describe("parseDownloadFilename", () => {
  it("uses the download query param when present", () => {
    const result = parseDownloadFilename(
      "https://www.iwara.tv/download/abc?download=Iwara%20-%20ECHO%20%5BzkgwZnoNtSwgd2%5D.mp4",
      "/video/zkgwZnoNtSwgd2/echo"
    );
    expect(result.fileName).toBe("Iwara - ECHO [zkgwZnoNtSwgd2].mp4");
    expect(result.baseName).toBe("Iwara - ECHO [zkgwZnoNtSwgd2]");
    expect(result.extension).toBe("mp4");
  });

  it("falls back to the video id (no brand prefix)", () => {
    const result = parseDownloadFilename(
      "https://www.iwara.tv/download/abc",
      "/video/zkgwZnoNtSwgd2/echo"
    );
    expect(result.fileName).toBe("zkgwZnoNtSwgd2.mp4");
    expect(result.extension).toBe("mp4");
  });

  it("prefers the supplied filename for non-iwara media", () => {
    const result = parseDownloadFilename(
      "https://ev-h.phncdn.com/videos/abc/master.m3u8?token=1",
      "https://www.pornhub.com/view_video.php?viewkey=abc",
      "My Clip.mp4"
    );
    expect(result.fileName).toBe("My Clip.mp4");
    expect(result.extension).toBe("mp4");
  });

  it("derives the name from the url path when no hint is given", () => {
    const result = parseDownloadFilename(
      "https://ev-h.phncdn.com/videos/abc/1080P_4000K_1.mp4",
      "https://www.pornhub.com/view_video.php?viewkey=abc"
    );
    expect(result.fileName).toBe("1080P_4000K_1.mp4");
    expect(result.extension).toBe("mp4");
  });
});

describe("isDownloadUrl", () => {
  it("recognizes lynx/topaz download links with a download param", () => {
    expect(
      isDownloadUrl(
        "https://lynx.iwara.tv/download?hash=abc&download=Iwara%20-%20ECHO.mp4&expires=1786199276"
      )
    ).toBe(true);
  });

  it("rejects regular pages and download paths without a download param", () => {
    expect(isDownloadUrl("https://www.iwara.tv/video/zkgwZnoNtSwgd2/echo")).toBe(false);
    expect(isDownloadUrl("https://lynx.iwara.tv/download?hash=abc")).toBe(false);
    expect(isDownloadUrl("https://example.com/")).toBe(false);
  });
});

describe("splitFileName", () => {
  it("splits base name and lowercased extension", () => {
    expect(splitFileName("A.MP4")).toEqual({ baseName: "A", extension: "mp4" });
  });

  it("handles names without an extension", () => {
    expect(splitFileName("noext")).toEqual({ baseName: "noext", extension: "" });
  });
});

describe("scrapeToMeta", () => {
  it("prefills meta from scraped page data and artist prefs", () => {
    const meta = scrapeToMeta({
      scraped: {
        artist: ["bender"],
        tags: ["miku", "dance"],
        title: "ECHO",
        videoId: "zkgwZnoNtSwgd2",
        url: "https://www.iwara.tv/video/zkgwZnoNtSwgd2/echo",
        fileName: "Iwara - ECHO.mp4",
        extension: "mp4",
        posterStyle: 'url("//i.iwara.tv/poster.jpg")',
      },
      request: { downloadId: 1, fileName: "raw.bin", url: "https://x/y" },
      prefs: { genre: "Vocaloid", character: "Miku" },
    });
    expect(meta.title).toBe("ECHO");
    expect(meta.artist).toEqual(["bender"]);
    expect(meta.tags).toEqual(["miku", "dance"]);
    expect(meta.genre).toBe("Vocaloid");
    expect(meta.character).toEqual(["Miku"]);
    expect(meta.video_id).toBe("zkgwZnoNtSwgd2");
    expect(meta.file_name).toBe("Iwara - ECHO");
    expect(meta.extension).toBe("mp4");
    expect(meta.thumbnailUrl).toBe('url("//i.iwara.tv/poster.jpg")');
  });

  it("falls back to the request filename and empty fields", () => {
    const meta = scrapeToMeta({
      scraped: {
        artist: [],
        tags: [],
        title: "",
        videoId: "",
        url: "",
        fileName: "",
        extension: "",
        posterStyle: "",
      },
      request: { downloadId: 1, fileName: "video.webm", url: "https://x/y" },
      prefs: undefined,
    });
    expect(meta.file_name).toBe("video");
    expect(meta.extension).toBe("webm");
    expect(meta.genre).toBe("");
    expect(meta.character).toEqual([]);
  });
});
