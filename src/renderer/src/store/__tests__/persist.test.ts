import { beforeEach, describe, expect, it } from "vitest";
import type { Video } from "@shared/types";
import { blankCriteria, resetAppStore } from "@/test/resetStore";
import { useAppStore } from "../useAppStore";

const STORAGE_KEY = "media-player-settings";

function makeVideo(id: string): Video {
  return {
    id,
    file: `${id}.mp4`,
    thumbnail: "",
    title: id,
    durationMs: 0,
    genre: "",
    tags: [],
    artist: [],
    character: [],
    created: "2024-01-01T00:00:00.000Z",
    modified: "2024-01-01T00:00:00.000Z",
    extension: "mp4",
  };
}

function readPersisted(): { state: Record<string, unknown> } | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as { state: Record<string, unknown> }) : null;
}

describe("persisted settings", () => {
  beforeEach(() => {
    localStorage.clear();
    resetAppStore();
  });

  it("writes only the durable keys, keeping the session-only criteria out", () => {
    useAppStore.setState({
      volume: 0.42,
      videos: [makeVideo("a")],
      playlist: [makeVideo("a")],
      criteria: blankCriteria({
        query: "secret",
        tags: ["red"],
        sort: "title-asc",
        hideUnplayable: true,
      }),
    });

    const persisted = readPersisted();
    expect(persisted?.state.volume).toBe(0.42);
    // 排序与隐藏开关留在存储里（扁平键）……
    expect(persisted?.state.sort).toBe("title-asc");
    expect(persisted?.state.hideUnplayable).toBe(true);
    // ……但查询、facet 与记录本身不进存储
    expect(persisted?.state).not.toHaveProperty("criteria");
    expect(persisted?.state).not.toHaveProperty("videos");
    expect(persisted?.state).not.toHaveProperty("playlist");
    expect(persisted?.state).not.toHaveProperty("initStarted");
  });

  it("rehydrates the stored display options back into criteria", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { volume: 0.1, sort: "date-desc", hideUnplayable: true },
        version: 0,
      })
    );

    await useAppStore.persist.rehydrate();

    const s = useAppStore.getState();
    expect(s.volume).toBe(0.1);
    expect(s.criteria.sort).toBe("date-desc");
    expect(s.criteria.hideUnplayable).toBe(true);
  });

  it("migrates the legacy sortMode key and sanitises a broken shortcut map", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { sortMode: "title-desc", shortcuts: "not-a-map" }, version: 0 })
    );

    await useAppStore.persist.rehydrate();

    expect(useAppStore.getState().criteria.sort).toBe("title-desc");
    // 非法数据回到默认绑定，而不是把坏值带进运行时
    expect(useAppStore.getState().shortcuts.playPause.length).toBeGreaterThan(0);
  });
});
