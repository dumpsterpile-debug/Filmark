import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Video } from "@shared/types";
import i18n from "@/i18n";
import { installFakeApi, uninstallFakeApi, type FakeApi } from "@/test/fakeApi";
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

const ids = (items: Video[]): string[] => items.map((v) => v.id);

describe("library loading", () => {
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

  it("publishes the records, the source and a fresh page", async () => {
    const a = makeVideo({ id: "a" });
    const b = makeVideo({ id: "b" });
    fake.setRecords([a, b]);
    resetAppStore({ page: 3 });

    await useAppStore.getState().loadMetadata();

    const s = useAppStore.getState();
    expect(ids(s.videos)).toEqual(["a", "b"]);
    expect(s.metadataPath).toBe("/fake/metadata.json");
    expect(s.metadataFileCount).toBe(1);
    expect(s.page).toBe(1);
    expect(s.loading).toBe(false);
    expect(s.loadError).toBeNull();
    expect(s.toasts.map((t) => t.text)).toContain(i18n.t("toast.loadedSingle", { count: 2 }));
  });

  it("surfaces a failure without dropping the records already loaded", async () => {
    resetAppStore({ videos: [makeVideo({ id: "kept" })] });
    fake.failNextLoad({ error: "boom", errorCode: "E_NO_JSON" });

    await useAppStore.getState().loadMetadata();

    const s = useAppStore.getState();
    expect(s.loading).toBe(false);
    expect(s.loadError).toBe("boom");
    expect(s.loadErrorCode).toBe("E_NO_JSON");
    expect(ids(s.videos)).toEqual(["kept"]);
  });

  it("reports the degraded state when there is no desktop port", async () => {
    uninstallFakeApi();

    await useAppStore.getState().loadMetadata();

    const s = useAppStore.getState();
    expect(s.loading).toBe(false);
    expect(s.loadError).toBe(i18n.t("toast.noDesktopApi"));
  });

  it("loads the saved playlist and attaches exactly one listener per event on every init", async () => {
    fake.setPlaylist([makeVideo({ id: "saved" })]);

    await useAppStore.getState().init();
    expect(ids(useAppStore.getState().playlist)).toEqual(["saved"]);
    expect(fake.calls.loadPlaylist).toBe(1);
    expect(fake.listenerCount()).toEqual({ intercept: 1, progress: 1 });

    // 门没重置：第二次 init 直接早退
    await useAppStore.getState().init();
    expect(fake.calls.loadPlaylist).toBe(1);
    expect(fake.listenerCount()).toEqual({ intercept: 1, progress: 1 });

    // 重入：会重新加载，但监听不会叠加
    useAppStore.setState({ initStarted: false });
    await useAppStore.getState().init();
    expect(fake.calls.loadPlaylist).toBe(2);
    expect(fake.calls.loadMetadata).toHaveLength(2);
    expect(fake.listenerCount()).toEqual({ intercept: 1, progress: 1 });
  });

  it("routes download events through the attached listeners", async () => {
    await useAppStore.getState().init();

    fake.emit.downloadIntercept({ downloadId: 7, fileName: "x.mp4", url: "https://example.com/x" });
    expect(useAppStore.getState().downloadRequest?.downloadId).toBe(7);

    fake.emit.downloadProgress({
      downloadId: 7,
      fileName: "x.mp4",
      receivedBytes: 1,
      totalBytes: 2,
      state: "progressing",
    });
    expect(useAppStore.getState().downloadProgress?.downloadId).toBe(7);
  });
});
