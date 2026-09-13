import { describe, expect, it } from "vitest";
import { thumbnailCachePath, thumbnailSeekMs } from "../thumbnail";

describe("thumbnailCachePath", () => {
  it("derives a stable hash-based file name in the cache dir", () => {
    const a = thumbnailCachePath("C:/videos/a.mp4", "C:/cache");
    const b = thumbnailCachePath("C:/videos/a.mp4", "C:/cache");
    expect(a).toBe(b);
    expect(a.split(/[\\/]/).slice(0, -1).join("/")).toBe("C:/cache");
    expect(a.endsWith(".jpg")).toBe(true);
  });

  it("produces different names for different video paths", () => {
    const a = thumbnailCachePath("C:/videos/a.mp4", "C:/cache");
    const b = thumbnailCachePath("C:/videos/b.mp4", "C:/cache");
    expect(a).not.toBe(b);
  });
});

describe("thumbnailSeekMs", () => {
  it("seeks to about 1/8 of the duration", () => {
    expect(thumbnailSeekMs(8000)).toBe(1000);
    expect(thumbnailSeekMs(0)).toBe(0);
  });
});
