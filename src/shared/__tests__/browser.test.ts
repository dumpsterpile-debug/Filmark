import { describe, expect, it } from "vitest";
import { isValidHttpUrl, normalizeWebUrl, resolveDownloadDir } from "../browser";

describe("isValidHttpUrl", () => {
  it("accepts http and https urls", () => {
    expect(isValidHttpUrl("http://example.com")).toBe(true);
    expect(isValidHttpUrl("https://www.iwara.tv/video/abc")).toBe(true);
  });

  it("rejects non-http schemes", () => {
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpUrl("file:///C:/x")).toBe(false);
  });

  it("rejects empty, whitespace and malformed input", () => {
    expect(isValidHttpUrl("")).toBe(false);
    expect(isValidHttpUrl("   ")).toBe(false);
    expect(isValidHttpUrl("not a url")).toBe(false);
    expect(isValidHttpUrl("http://")).toBe(false);
  });
});

describe("normalizeWebUrl", () => {
  it("returns a valid saved url trimmed", () => {
    expect(normalizeWebUrl("  https://a.tv/  ", "https://fallback.tv")).toBe("https://a.tv/");
  });

  it("falls back when saved url is invalid or empty", () => {
    expect(normalizeWebUrl("", "https://fallback.tv")).toBe("https://fallback.tv");
    expect(normalizeWebUrl("ftp://x", "https://fallback.tv")).toBe("https://fallback.tv");
    expect(normalizeWebUrl(null, "https://fallback.tv")).toBe("https://fallback.tv");
  });
});

describe("resolveDownloadDir", () => {
  it("prefers a configured path", () => {
    expect(resolveDownloadDir("C:/downloads", "C:/system")).toBe("C:/downloads");
  });

  it("falls back to the system downloads directory when unset", () => {
    expect(resolveDownloadDir("", "C:/system")).toBe("C:/system");
    expect(resolveDownloadDir("   ", "C:/system")).toBe("C:/system");
    expect(resolveDownloadDir(null, "C:/system")).toBe("C:/system");
  });
});
