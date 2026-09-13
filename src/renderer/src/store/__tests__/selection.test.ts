import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Video } from "@shared/types";
import i18n from "@/i18n";
import { installFakeApi, uninstallFakeApi } from "@/test/fakeApi";
import { resetAppStore } from "@/test/resetStore";
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

const playlistIds = (): string[] => useAppStore.getState().playlist.map((v) => v.id);
const toastTexts = (): string[] => useAppStore.getState().toasts.map((t) => t.text);

describe("selection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAppStore();
    installFakeApi();
    vi.clearAllTimers();
  });

  afterEach(() => {
    uninstallFakeApi();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("toggles multi-select and drops the current selection with it", () => {
    resetAppStore({ multiSelectMode: false, selectedIds: ["a"] });

    useAppStore.getState().toggleMultiSelect();

    expect(useAppStore.getState().multiSelectMode).toBe(true);
    expect(useAppStore.getState().selectedIds).toEqual([]);
  });

  it("adds and removes ids one at a time, and replaces them in bulk", () => {
    useAppStore.getState().toggleSelected("a");
    useAppStore.getState().toggleSelected("b");
    useAppStore.getState().toggleSelected("a");
    expect(useAppStore.getState().selectedIds).toEqual(["b"]);

    useAppStore.getState().setSelectedIds(["x", "y"]);
    expect(useAppStore.getState().selectedIds).toEqual(["x", "y"]);

    useAppStore.getState().clearSelection();
    expect(useAppStore.getState().selectedIds).toEqual([]);
  });

  it("adds only the selected playable records and leaves multi-select", () => {
    const a = makeVideo({ id: "a" });
    const b = makeVideo({ id: "b" });
    const unplayable = makeVideo({ id: "u", playable: false });
    resetAppStore({
      videos: [a, b, unplayable],
      selectedIds: ["a", "u"],
      multiSelectMode: true,
    });

    useAppStore.getState().addSelectedToPlaylist();

    expect(playlistIds()).toEqual(["a"]);
    expect(useAppStore.getState().multiSelectMode).toBe(false);
    expect(useAppStore.getState().selectedIds).toEqual([]);
    expect(toastTexts()).toContain(i18n.t("toast.addedSelected", { count: 1 }));
  });

  it("keeps the selection when nothing is selected", () => {
    resetAppStore({ videos: [makeVideo({ id: "a" })], selectedIds: [], multiSelectMode: true });

    useAppStore.getState().addSelectedToPlaylist();

    expect(playlistIds()).toEqual([]);
    expect(useAppStore.getState().selectedIds).toEqual([]);
    expect(useAppStore.getState().multiSelectMode).toBe(true);
    expect(toastTexts()).toContain(i18n.t("toast.noSelection"));
  });

  it("does not grow the playlist when the same records are added twice", () => {
    const a = makeVideo({ id: "a" });
    resetAppStore({ videos: [a], selectedIds: ["a"], multiSelectMode: true });
    useAppStore.getState().addSelectedToPlaylist();

    useAppStore.setState({ selectedIds: ["a"], multiSelectMode: true });
    useAppStore.getState().addSelectedToPlaylist();

    expect(playlistIds()).toEqual(["a"]);
    expect(toastTexts()).toContain(i18n.t("toast.addedSelected", { count: 0 }));
  });
});
