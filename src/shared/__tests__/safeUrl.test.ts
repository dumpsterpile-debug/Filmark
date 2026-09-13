import { describe, expect, it } from "vitest";
import { hostMatches, isPrivateOrLoopbackHost, normalizeHost, safeUrl } from "../safeUrl";

describe("normalizeHost", () => {
  it("accepts bare hosts, ports, paths and full URLs", () => {
    expect(normalizeHost("Example.COM")).toBe("example.com");
    expect(normalizeHost("example.com:8443")).toBe("example.com");
    expect(normalizeHost("https://www.xnxx.com/video-abc/x")).toBe("www.xnxx.com");
    expect(normalizeHost("spankbang.com/a/b")).toBe("spankbang.com");
    expect(normalizeHost("example.com.")).toBe("example.com");
  });

  it("returns empty string for blank input", () => {
    expect(normalizeHost("")).toBe("");
    expect(normalizeHost(null)).toBe("");
    expect(normalizeHost(undefined)).toBe("");
    expect(normalizeHost("   ")).toBe("");
  });
});

describe("hostMatches", () => {
  it("matches exact hosts and dot-suffix subdomains", () => {
    expect(hostMatches("example.com", "example.com")).toBe(true);
    expect(hostMatches("cdn.example.com", "example.com")).toBe(true);
  });

  it("rejects lookalike suffixes", () => {
    expect(hostMatches("notexample.com", "example.com")).toBe(false);
    expect(hostMatches("example.com.evil.net", "example.com")).toBe(false);
  });

  it("accepts a full URL as the host argument", () => {
    expect(hostMatches("https://lynx.iwara.tv/download?download=a.mp4", "iwara.tv")).toBe(true);
  });

  it("returns false when either side normalizes to empty", () => {
    expect(hostMatches("", "example.com")).toBe(false);
    expect(hostMatches("example.com", "")).toBe(false);
  });
});

describe("isPrivateOrLoopbackHost", () => {
  it("flags loopback and private ranges", () => {
    expect(isPrivateOrLoopbackHost("localhost")).toBe(true);
    expect(isPrivateOrLoopbackHost("127.0.0.1")).toBe(true);
    expect(isPrivateOrLoopbackHost("192.168.1.10")).toBe(true);
    expect(isPrivateOrLoopbackHost("172.20.0.1")).toBe(true);
    expect(isPrivateOrLoopbackHost("example.com")).toBe(false);
    expect(isPrivateOrLoopbackHost("172.32.0.1")).toBe(false);
  });
});

describe("safeUrl", () => {
  const allow = new Set(["iwara.tv"]);

  it("accepts http(s) on an allowed host, including subdomains", () => {
    expect(safeUrl("https://i.iwara.tv/x.jpg", allow)).toBe("https://i.iwara.tv/x.jpg");
    expect(safeUrl("https://cdn.i.iwara.tv/x.jpg", allow)).toBe("https://cdn.i.iwara.tv/x.jpg");
  });

  it("rejects other schemes, other hosts and malformed input", () => {
    expect(safeUrl("ftp://i.iwara.tv/x.jpg", allow)).toBeNull();
    expect(safeUrl("file:///C:/x.jpg", allow)).toBeNull();
    expect(safeUrl("https://evil.example/x.jpg", allow)).toBeNull();
    expect(safeUrl("not-a-url", allow)).toBeNull();
  });

  it("rejects loopback and private hosts even when allowlisted", () => {
    expect(safeUrl("http://127.0.0.1/x.jpg", new Set(["127.0.0.1"]))).toBeNull();
    expect(safeUrl("http://localhost:3000/x.jpg", new Set(["localhost"]))).toBeNull();
  });

  it("matches allowlist entries regardless of their casing", () => {
    expect(safeUrl("https://i.iwara.tv/x.jpg", new Set(["I.IWARA.TV"]))).toBe(
      "https://i.iwara.tv/x.jpg"
    );
  });
});
