import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Video } from "@shared/types";
import i18n from "@/i18n";
import { installFakeApi, uninstallFakeApi, type FakeApi } from "@/test/fakeApi";
import { blankCriteria, resetAppStore } from "@/test/resetStore";
import { useAppStore } from "../useAppStore";

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

const ids = (items: Video[]): string[] => items.map((v) => v.id);
const playlistIds = (): string[] => ids(useAppStore.getState().playlist);
const toastTexts = (): string[] => useAppStore.getState().toasts.map((t) => t.text);

describe("playlist", () => {
  let fake: FakeApi;

  beforeEach(() => {
    vi.useFakeTimers();
    resetAppStore();
    fake = installFakeApi();
    vi.clearAllTimers();
  });

  afterEach(() => {
    uninstallFakeApi();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("dedupes by id and drops unplayable records", () => {
    const a = makeVideo({ id: "a" });
    const b = makeVideo({ id: "b", playable: false });

    useAppStore.getState().addToPlaylist([a, b, a], { silent: true });

    expect(playlistIds()).toEqual(["a"]);
  });

  it("reports the number of records actually added, not the number passed in", () => {
    const a = makeVideo({ id: "a" });

    expect(useAppStore.getState().addToPlaylist([a])).toBe(1);
    expect(toastTexts()).toContain(i18n.t("toast.addedToPlaylist", { count: 1 }));

    // 重复加入：播放单不变，提示也不再虚报条数
    expect(useAppStore.getState().addToPlaylist([a])).toBe(0);
    expect(playlistIds()).toEqual(["a"]);
    expect(toastTexts()).toContain(i18n.t("toast.addedToPlaylist", { count: 0 }));
  });

  it("reorders within range and ignores out-of-range indices", () => {
    const items = ["a", "b", "c"].map((id) => makeVideo({ id }));
    useAppStore.getState().addToPlaylist(items, { silent: true });

    useAppStore.getState().reorderPlaylist(0, 2);
    expect(playlistIds()).toEqual(["b", "c", "a"]);

    useAppStore.getState().reorderPlaylist(-1, 1);
    useAppStore.getState().reorderPlaylist(0, 9);
    expect(playlistIds()).toEqual(["b", "c", "a"]);
  });

  it("prepends a missing video and only sets the current id for an existing one", () => {
    const a = makeVideo({ id: "a" });
    const b = makeVideo({ id: "b" });
    useAppStore.getState().addToPlaylist([b], { silent: true });

    useAppStore.getState().playVideo(a);
    expect(playlistIds()).toEqual(["a", "b"]);
    expect(useAppStore.getState().currentVideoId).toBe("a");

    useAppStore.getState().playVideo(b);
    expect(playlistIds()).toEqual(["a", "b"]);
    expect(useAppStore.getState().currentVideoId).toBe("b");
  });

  it("rebuilds the playlist from the visible list, not from every record", () => {
    const a = makeVideo({ id: "a", tags: ["red"] });
    const c = makeVideo({ id: "c", tags: ["blue"] });
    const unplayable = makeVideo({ id: "b", tags: ["red"], playable: false });
    resetAppStore({ videos: [a, unplayable, c], criteria: blankCriteria({ tags: ["red"] }) });

    expect(useAppStore.getState().selectAllAndPlay()).toBe(true);

    // 不可播放项即使可见也不进播放单；未命中的 c 不进
    expect(playlistIds()).toEqual(["a"]);
    expect(useAppStore.getState().currentVideoId).toBe("a");
  });

  it("reports an empty result without touching the playlist", () => {
    resetAppStore({ videos: [makeVideo({ id: "b", playable: false })] });

    expect(useAppStore.getState().selectAllAndPlay()).toBe(false);

    expect(playlistIds()).toEqual([]);
    expect(toastTexts()).toContain(i18n.t("toast.nothingToAdd"));
  });

  it("saves the playlist once per debounce window with the final order", () => {
    const a = makeVideo({ id: "a" });
    const b = makeVideo({ id: "b" });

    useAppStore.getState().addToPlaylist([a], { silent: true });
    useAppStore.getState().addToPlaylist([b], { silent: true });

    vi.advanceTimersByTime(599);
    expect(fake.calls.savePlaylist).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(fake.calls.savePlaylist).toHaveLength(1);
    expect(fake.calls.savePlaylist.at(-1)?.map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("does not save when only unrelated state changes", () => {
    useAppStore.setState({ volume: 0.5 });

    vi.advanceTimersByTime(1000);

    expect(fake.calls.savePlaylist).toHaveLength(0);
  });
});
