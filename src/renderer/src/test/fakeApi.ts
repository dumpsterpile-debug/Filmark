import type {
  DownloadMeta,
  DownloadProgress,
  DownloadRequest,
  ImportedFileInfo,
  LoadMetadataResult,
  MediaApi,
  SaveResult,
  Video,
} from "@shared/types";
import { setApi } from "@/lib/api";

export interface FakeApiOptions {
  /** `loadMetadata` 返回的记录 */
  records?: Video[];
  /** `loadMetadata` 返回的来源路径 */
  source?: string;
  /** `loadPlaylist` 返回的播放单 */
  playlist?: Video[];
  /** `listImports` 返回的导入文件 */
  imports?: ImportedFileInfo[];
  /** `getDownloadsDir` 返回的目录 */
  downloadsDir?: string;
}

/** 假件记录下来的调用，供断言使用 */
export interface FakeApiCalls {
  loadMetadata: {
    path: string | undefined;
    persistedPath: string | undefined;
    language: string | undefined;
  }[];
  savePlaylist: Video[][];
  loadPlaylist: number;
  confirmDownload: {
    downloadId: number;
    downloadPath?: string;
    loadedSource?: string;
    persistedPath?: string;
    meta: DownloadMeta;
  }[];
  cancelDownload: number[];
  updateVideo: {
    videoId: string;
    fields: Record<string, unknown>;
    loadedSource: string | undefined;
    persistedPath: string | undefined;
  }[];
  importMetadata: { paths: string[]; existingIds: string[] }[];
  listImports: number;
}

export interface FakeApi {
  api: MediaApi;
  calls: FakeApiCalls;
  /** 模拟主进程向渲染层推送的通知 */
  emit: {
    downloadIntercept: (request: DownloadRequest) => void;
    downloadProgress: (progress: DownloadProgress) => void;
  };
  /** 当前绑定的监听器数量（用来验证 init 幂等、不叠加订阅） */
  listenerCount: () => { intercept: number; progress: number };
  setRecords: (videos: Video[]) => void;
  setPlaylist: (items: Video[]) => void;
  setImports: (items: ImportedFileInfo[]) => void;
  /** 让下一次 loadMetadata 返回失败（一次性） */
  failNextLoad: (result: { error: string; errorCode?: LoadMetadataResult["errorCode"] }) => void;
}

/**
 * 内存实现：`MediaApi` 的第二个适配器。
 *
 * 真实适配器是 `src/preload/index.ts`（走 IPC）；这个假件让 store 的每一条路径都能
 * 在 jsdom 里跑完 —— 以 `const api: MediaApi` 声明，所以端口加减成员时这里会编译报错。
 */
export function createFakeApi(options: FakeApiOptions = {}): FakeApi {
  let records = options.records ?? [];
  let playlist = options.playlist ?? [];
  let imports = options.imports ?? [];
  const source = options.source ?? "/fake/metadata.json";
  const downloadsDir = options.downloadsDir ?? "/fake/downloads";
  let nextLoadFailure: { error: string; errorCode?: LoadMetadataResult["errorCode"] } | null = null;

  const interceptListeners = new Set<(request: DownloadRequest) => void>();
  const progressListeners = new Set<(progress: DownloadProgress) => void>();

  const calls: FakeApiCalls = {
    loadMetadata: [],
    savePlaylist: [],
    loadPlaylist: 0,
    confirmDownload: [],
    cancelDownload: [],
    updateVideo: [],
    importMetadata: [],
    listImports: 0,
  };

  const ok: SaveResult = { ok: true };

  const api: MediaApi = {
    isDesktop: true,
    loadMetadata: async (path, persistedPath, language) => {
      calls.loadMetadata.push({ path, persistedPath, language });
      if (nextLoadFailure) {
        const failure = nextLoadFailure;
        nextLoadFailure = null;
        const failed: LoadMetadataResult = { ok: false, source: "", error: failure.error };
        if (failure.errorCode) failed.errorCode = failure.errorCode;
        return failed;
      }
      return {
        ok: true,
        source: path ?? source,
        count: records.length,
        fileCount: 1,
        videos: records,
      };
    },
    chooseMetadataFile: async () => null,
    chooseMetadataSource: async () => null,
    chooseDownloadDir: async () => null,
    getDownloadsDir: async () => downloadsDir,
    onDownloadIntercept: (callback) => {
      interceptListeners.add(callback);
      return () => {
        interceptListeners.delete(callback);
      };
    },
    onDownloadProgress: (callback) => {
      progressListeners.add(callback);
      return () => {
        progressListeners.delete(callback);
      };
    },
    confirmDownload: async (payload) => {
      calls.confirmDownload.push(payload);
      return ok;
    },
    cancelDownload: async (downloadId) => {
      calls.cancelDownload.push(downloadId);
    },
    downloadFromWebContents: async () => {},
    openExternal: async () => {},
    chooseImportSources: async () => [],
    previewImport: async () => ({
      newCount: 0,
      duplicateCount: 0,
      failedFiles: [],
      samples: [],
    }),
    importMetadata: async (paths, existingIds) => {
      calls.importMetadata.push({ paths, existingIds });
      return { ok: true, imported: 0, skipped: 0, source };
    },
    listImports: async () => {
      calls.listImports += 1;
      return imports;
    },
    removeImport: async () => ok,
    clearImports: async () => ok,
    updateVideo: async (videoId, fields, loadedSource, persistedPath) => {
      calls.updateVideo.push({ videoId, fields, loadedSource, persistedPath });
      return ok;
    },
    generateThumbnail: async () => ({ ok: true, thumbnail: "" }),
    savePlaybackProgress: async () => ok,
    loadPlaybackProgress: async () => ({ ok: true, progress: {} }),
    probeFile: async () => ({ ok: true, durationMs: 0 }),
    relocateFile: async () => null,
    openInFolder: async () => {},
    savePlaylist: async (items) => {
      calls.savePlaylist.push([...items]);
      return ok;
    },
    loadPlaylist: async () => {
      calls.loadPlaylist += 1;
      return { ok: true, items: playlist };
    },
  };

  return {
    api,
    calls,
    emit: {
      downloadIntercept: (request) => {
        for (const listener of interceptListeners) listener(request);
      },
      downloadProgress: (progress) => {
        for (const listener of progressListeners) listener(progress);
      },
    },
    listenerCount: () => ({
      intercept: interceptListeners.size,
      progress: progressListeners.size,
    }),
    setRecords: (videos) => {
      records = videos;
    },
    setPlaylist: (items) => {
      playlist = items;
    },
    setImports: (items) => {
      imports = items;
    },
    failNextLoad: (result) => {
      nextLoadFailure = result;
    },
  };
}

/** 创建内存端口并装进渲染层；用例结束用 `uninstallFakeApi()` 卸下 */
export function installFakeApi(options: FakeApiOptions = {}): FakeApi {
  const fake = createFakeApi(options);
  setApi(fake.api);
  return fake;
}

export function uninstallFakeApi(): void {
  setApi(null);
}
