import { describe, expect, it } from "vitest";
import { parseFfmpegDurationMs } from "../probe";

describe("parseFfmpegDurationMs", () => {
  it("parses a standard ffmpeg Duration line", () => {
    const stderr =
      "  Duration: 00:01:23.45, start: 0.000000, bitrate: 1234 kb/s\n" +
      "  Stream #0:0: Video: h264";
    expect(parseFfmpegDurationMs(stderr)).toBe(83450);
  });

  it("parses durations over an hour", () => {
    expect(parseFfmpegDurationMs("Duration: 01:02:03.00")).toBe(3723000);
  });

  it("returns 0 when no Duration line is present", () => {
    expect(parseFfmpegDurationMs("Stream #0:0: Video: h264")).toBe(0);
  });

  it("returns 0 on malformed duration", () => {
    expect(parseFfmpegDurationMs("Duration: not-a-time")).toBe(0);
  });
});
