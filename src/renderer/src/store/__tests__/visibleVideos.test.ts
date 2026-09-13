import { beforeEach, describe, expect, it } from "vitest";
import type { Video } from "@shared/types";
import { blankCriteria, blankDraft, resetAppStore } from "@/test/resetStore";
import { selectVisibleVideos, useAppStore } from "../useAppStore";

function makeVideo(overrides: Partial<Video> & { id: string }): Video {
  return {
    file: `${overrides.id}.mp4`,
    thumbnail: "",
    title: overrides.id,
    durationMs: 0,
    genre: "",
    tags: [],
    artist: [],
    character: [],
    created: "2024-01-01T00:00:00.000Z",
    modified: "2024-01-01T00:00:00.000Z",
    extension: "mp4",
    ...overrides,
  };
}

const playable = makeVideo({ id: "playable", title: "Playable", tags: ["red"], genre: "Drama" });
const unplayable = makeVideo({
  id: "unplayable",
  title: "Unplayable",
  tags: ["red"],
  genre: "Drama",
  playable: false,
});

describe("selectVisibleVideos", () => {
  beforeEach(() => {
    resetAppStore({ videos: [playable, unplayable] });
  });

  it("returns every record when nothing is filtered", () => {
    expect(selectVisibleVideos().map((v) => v.id)).toEqual(["playable", "unplayable"]);
  });

  it("honours hideUnplayable from the same single source", () => {
    // 回归守卫：此前 toolbar 开关只在 HomePage 生效，store 内部两处入口都漏掉了它
    useAppStore.setState({ criteria: blankCriteria({ hideUnplayable: true }) });
    expect(selectVisibleVideos().map((v) => v.id)).toEqual(["playable"]);
  });

  it("honours the applied facets", () => {
    useAppStore.setState({ criteria: blankCriteria({ tags: ["red"] }) });
    expect(selectVisibleVideos()).toHaveLength(2);

    useAppStore.setState({ criteria: blankCriteria({ tags: ["green"] }) });
    expect(selectVisibleVideos()).toEqual([]);
  });

  it("reads applied criteria, not the drafts", () => {
    useAppStore.setState({ draft: blankDraft({ query: "Unplayable" }) });
    expect(selectVisibleVideos()).toHaveLength(2);
  });
});
