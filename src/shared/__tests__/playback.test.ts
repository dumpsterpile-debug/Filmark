import { describe, expect, it } from "vitest";
import { mergeProgress, shouldResume } from "../playback";

describe("shouldResume", () => {
  it("resumes when saved progress is meaningful and more than 5s from the end", () => {
    expect(shouldResume(30, 100)).toBe(true);
  });

  it("does not resume near the end", () => {
    expect(shouldResume(97, 100)).toBe(false);
  });

  it("does not resume at the start or with unknown duration", () => {
    expect(shouldResume(0, 100)).toBe(false);
    expect(shouldResume(30, 0)).toBe(false);
  });
});

describe("mergeProgress", () => {
  it("merges updates into existing progress by file path", () => {
    const merged = mergeProgress({ "C:/a.mp4": 10 }, { "C:/a.mp4": 20, "C:/b.mp4": 5 });
    expect(merged).toEqual({ "C:/a.mp4": 20, "C:/b.mp4": 5 });
  });

  it("drops progress below the minimum threshold", () => {
    const merged = mergeProgress({}, { "C:/a.mp4": 2 });
    expect(merged).toEqual({});
  });
});
