import { describe, expect, it } from "vitest";
import { applyFileRelocations, isPlayableVideo } from "../videoPlayability";
import { normalizeVideos } from "../videos";
import type { Video } from "../types";

function video(overrides: Partial<Video>): Video {
  return {
    id: "video-0",
    file: "",
    playable: false,
    thumbnail: "",
    title: "T",
    durationMs: 0,
    genre: "",
    tags: [],
    artist: [],
    character: [],
    created: "",
    modified: "",
    extension: "",
    ...overrides,
  };
}

describe("isPlayableVideo", () => {
  it("is playable when file is present", () => {
    expect(isPlayableVideo("C:/a.mp4")).toBe(true);
  });

  it("is not playable when file is empty", () => {
    expect(isPlayableVideo("")).toBe(false);
  });
});

describe("applyFileRelocations", () => {
  it("fills the file field from a relocation mapping", () => {
    const result = applyFileRelocations([video({ id: "video-0", title: "A" })], {
      "video-0": "C:/fixed.mp4",
    });
    expect(result[0]?.file).toBe("C:/fixed.mp4");
  });

  it("leaves records without a mapping unchanged", () => {
    const result = applyFileRelocations([video({ id: "video-0", title: "A" })], {});
    expect(result[0]?.file).toBe("");
  });
});

describe("normalizeVideos playable flag", () => {
  it("marks records without a file as not playable", () => {
    const videos = normalizeVideos([{ title: "NoFile" }, { file: "C:/a.mp4" }]);
    expect(videos[0]?.playable).toBe(false);
    expect(videos[1]?.playable).toBe(true);
  });
});
