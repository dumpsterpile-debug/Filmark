import { describe, expect, it } from "vitest";
import { isSupportedCodec, parseFfmpegCodec } from "../codec";

describe("parseFfmpegCodec", () => {
  it("extracts the video codec from ffmpeg stderr", () => {
    const stderr = "  Stream #0:0: Video: hevc (Main) (hev1 / 0x31766568), yuv420p";
    expect(parseFfmpegCodec(stderr)).toBe("hevc");
  });

  it("returns empty when no video stream is found", () => {
    expect(parseFfmpegCodec("  Stream #0:1: Audio: aac")).toBe("");
  });
});

describe("isSupportedCodec", () => {
  it("accepts h264 and vp9", () => {
    expect(isSupportedCodec("h264")).toBe(true);
    expect(isSupportedCodec("vp9")).toBe(true);
  });

  it("rejects hevc and unknown codecs", () => {
    expect(isSupportedCodec("hevc")).toBe(false);
    expect(isSupportedCodec("")).toBe(false);
  });
});
