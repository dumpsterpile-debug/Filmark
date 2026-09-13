import { dirname, isAbsolute, join, parse, relative } from "node:path";
import { describe, expect, it } from "vitest";
import type { DownloadMeta, DownloadProgress, DownloadRequest } from "@shared/types";
import {
  DownloadInterception,
  type DownloadItemLike,
  type DownloadInterceptionDeps,
} from "../downloadInterception";

// 路径断言必须与平台无关：CI 跑在 Linux，本地是 Windows。
// 用原生根目录构造输入，否则 `C:/x` 在 POSIX 上是相对路径。
const VOLUME_ROOT = parse(process.cwd()).root;
const DEFAULT_DOWNLOADS = join(VOLUME_ROOT, "Downloads");

/** 假 DownloadItem：只实现本模块真正用到的方法，并可手动触发事件 */
class FakeItem implements DownloadItemLike {
  cancelled = false;
  savePath = "";
  paused = false;
  received = 0;
  total = 4096;

  private readonly listeners = {
    updated: [] as (() => void)[],
    done: [] as ((event: unknown, state: string) => void)[],
  };

  constructor(
    private readonly url: string,
    private readonly fileName: string
  ) {}

  getURL(): string {
    return this.url;
  }
  getFilename(): string {
    return this.fileName;
  }
  getReceivedBytes(): number {
    return this.received;
  }
  getTotalBytes(): number {
    return this.total;
  }
  getSavePath(): string {
    return this.savePath;
  }
  isPaused(): boolean {
    return this.paused;
  }
  setSavePath(path: string): void {
    this.savePath = path;
  }
  cancel(): void {
    this.cancelled = true;
  }

  on(event: "updated", listener: () => void): unknown;
  on(event: "done", listener: (event: unknown, state: string) => void): unknown;
  on(
    event: "updated" | "done",
    listener: (() => void) | ((event: unknown, state: string) => void)
  ): unknown {
    if (event === "updated") this.listeners.updated.push(listener as () => void);
    else this.listeners.done.push(listener as (event: unknown, state: string) => void);
    return this;
  }

  fireUpdated(): void {
    for (const listener of this.listeners.updated) listener();
  }

  fireDone(state: string): void {
    for (const listener of this.listeners.done) listener({}, state);
  }
}

interface Harness {
  machine: DownloadInterception;
  requests: DownloadRequest[];
  progress: DownloadProgress[];
  completed: { meta: DownloadMeta; savePath: string; context: unknown }[];
  triggered: string[];
  createdDirs: string[];
}

function makeHarness(downloadsDir = DEFAULT_DOWNLOADS): Harness {
  const requests: DownloadRequest[] = [];
  const progress: DownloadProgress[] = [];
  const completed: { meta: DownloadMeta; savePath: string; context: unknown }[] = [];
  const triggered: string[] = [];
  const createdDirs: string[] = [];

  const deps: DownloadInterceptionDeps = {
    downloadsDir: () => downloadsDir,
    ensureDir: (dir) => createdDirs.push(dir),
    triggerGuestDownload: (url) => triggered.push(url),
    requestMeta: (request) => requests.push(request),
    reportProgress: (p) => progress.push(p),
    complete: (meta, savePath, context) => {
      completed.push({ meta, savePath, context });
      return Promise.resolve();
    },
  };

  return {
    machine: new DownloadInterception(deps),
    requests,
    progress,
    completed,
    triggered,
    createdDirs,
  };
}

describe("DownloadInterception", () => {
  it("cancels the first download and asks the renderer for metadata", () => {
    const h = makeHarness();
    const item = new FakeItem("https://cdn.example/v.mp4", "v.mp4");

    expect(h.machine.handleDownload(item)).toBe("intercepted");
    expect(item.cancelled).toBe(true);
    expect(h.requests).toEqual([
      { downloadId: 1, fileName: "v.mp4", url: "https://cdn.example/v.mp4" },
    ]);
    expect(item.savePath).toBe("");
  });

  it("does not cancel the re-triggered download after confirmation", () => {
    const h = makeHarness();
    const first = new FakeItem("https://cdn.example/v.mp4", "v.mp4");
    h.machine.handleDownload(first);

    expect(
      h.machine.confirm({
        downloadId: 1,
        downloadPath: join(VOLUME_ROOT, "Custom"),
        meta: { file_name: "clip", file_extension: "mp4" },
      })
    ).toBe(true);
    expect(h.triggered).toEqual(["https://cdn.example/v.mp4"]);

    const second = new FakeItem("https://cdn.example/v.mp4", "v.mp4");
    expect(h.machine.handleDownload(second)).toBe("confirmed");
    expect(second.cancelled).toBe(false);
    expect(second.savePath).toBe(join(VOLUME_ROOT, "Custom", "clip.mp4"));
    expect(h.createdDirs).toEqual([join(VOLUME_ROOT, "Custom")]);
  });

  it("falls back to the downloads dir and derives the extension from meta", () => {
    const h = makeHarness(join(VOLUME_ROOT, "Default"));
    h.machine.handleDownload(new FakeItem("https://cdn.example/v.mp4", "v.mp4"));
    h.machine.confirm({
      downloadId: 1,
      meta: { file_name: "clip", file_extension: ".mkv" },
    });

    const second = new FakeItem("https://cdn.example/v.mp4", "v.mp4");
    h.machine.handleDownload(second);
    expect(second.savePath).toBe(join(VOLUME_ROOT, "Default", "clip.mkv"));
  });

  it("refuses to confirm when nothing is pending", () => {
    const h = makeHarness();
    expect(h.machine.confirm({ downloadId: 9, meta: {} })).toBe(false);
    expect(h.triggered).toEqual([]);
  });

  it("reports progress while the download runs", () => {
    const h = makeHarness();
    h.machine.handleDownload(new FakeItem("https://cdn.example/v.mp4", "v.mp4"));
    h.machine.confirm({ downloadId: 1, meta: { file_name: "clip" } });
    const item = new FakeItem("https://cdn.example/v.mp4", "v.mp4");
    h.machine.handleDownload(item);

    item.received = 1024;
    item.fireUpdated();

    expect(h.progress).toEqual([
      {
        downloadId: 1,
        fileName: "v.mp4",
        receivedBytes: 1024,
        totalBytes: 4096,
        state: "progressing",
      },
    ]);
    item.paused = true;
    item.fireUpdated();
    expect(h.progress[1]?.state).toBe("interrupted");
  });

  it("hands the completed download to the writer with its source context", async () => {
    const h = makeHarness();
    h.machine.handleDownload(new FakeItem("https://cdn.example/v.mp4", "v.mp4"));
    h.machine.confirm({
      downloadId: 1,
      meta: { file_name: "clip" },
      loadedSource: "C:/custom/library.json",
      persistedPath: "C:/persisted.json",
    });

    const item = new FakeItem("https://cdn.example/v.mp4", "v.mp4");
    h.machine.handleDownload(item);
    item.savePath = join(DEFAULT_DOWNLOADS, "clip.mp4");
    item.fireDone("completed");

    expect(h.progress.at(-1)?.state).toBe("completed");
    expect(h.completed).toHaveLength(1);
    expect(h.completed[0]?.savePath).toBe(join(DEFAULT_DOWNLOADS, "clip.mp4"));
    expect(h.completed[0]?.context).toEqual({
      loadedSource: "C:/custom/library.json",
      persistedPath: "C:/persisted.json",
    });
  });

  it("does not write metadata for an interrupted download", () => {
    const h = makeHarness();
    h.machine.handleDownload(new FakeItem("https://cdn.example/v.mp4", "v.mp4"));
    h.machine.confirm({ downloadId: 1, meta: { file_name: "clip" } });
    const item = new FakeItem("https://cdn.example/v.mp4", "v.mp4");
    h.machine.handleDownload(item);

    item.fireDone("interrupted");

    expect(h.completed).toEqual([]);
    expect(h.progress.at(-1)?.state).toBe("interrupted");
  });

  it("cancels a tracked download and drops the pending confirmation", () => {
    const h = makeHarness();
    h.machine.handleDownload(new FakeItem("https://cdn.example/v.mp4", "v.mp4"));
    h.machine.confirm({ downloadId: 1, meta: { file_name: "clip" } });
    const item = new FakeItem("https://cdn.example/v.mp4", "v.mp4");
    h.machine.handleDownload(item);

    h.machine.cancel(1);

    expect(item.cancelled).toBe(true);
    // 待确认状态已清空，同一 URL 再次触发会被当作首次触发
    expect(h.machine.handleDownload(new FakeItem("https://cdn.example/v.mp4", "v.mp4"))).toBe(
      "intercepted"
    );
  });

  it("treats a different URL as a new interception even while one is pending", () => {
    const h = makeHarness();
    h.machine.handleDownload(new FakeItem("https://cdn.example/a.mp4", "a.mp4"));
    const other = new FakeItem("https://cdn.example/b.mp4", "b.mp4");

    expect(h.machine.handleDownload(other)).toBe("intercepted");
    expect(other.cancelled).toBe(true);
  });

  it("keeps tracking separate downloads under distinct ids", () => {
    const h = makeHarness();
    h.machine.handleDownload(new FakeItem("https://cdn.example/a.mp4", "a.mp4"));
    h.machine.confirm({ downloadId: 1, meta: { file_name: "a" } });
    const a = new FakeItem("https://cdn.example/a.mp4", "a.mp4");
    h.machine.handleDownload(a);

    h.machine.handleDownload(new FakeItem("https://cdn.example/b.mp4", "b.mp4"));
    h.machine.confirm({ downloadId: 2, meta: { file_name: "b" } });
    const b = new FakeItem("https://cdn.example/b.mp4", "b.mp4");
    h.machine.handleDownload(b);

    b.fireDone("completed");

    expect(h.completed).toHaveLength(1);
    expect(h.completed[0]?.meta.file_name).toBe("b");
  });

  it("keeps a hostile file name inside the target directory", () => {
    const h = makeHarness();
    h.machine.handleDownload(new FakeItem("https://cdn.example/v.mp4", "v.mp4"));
    h.machine.confirm({ downloadId: 1, meta: { file_name: "../../escape" } });

    const item = new FakeItem("https://cdn.example/v.mp4", "v.mp4");
    h.machine.handleDownload(item);

    // sanitizeFileName 会把路径分隔符换成下划线；无论文件名多恶意，落点都必须留在目标目录内
    expect(item.cancelled).toBe(false);
    expect(dirname(item.savePath)).toBe(DEFAULT_DOWNLOADS);
    expect(isAbsolute(relative(DEFAULT_DOWNLOADS, item.savePath))).toBe(false);
  });
});
