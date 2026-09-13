import type {
  ConfirmDownloadPayload,
  DownloadProgress,
  DownloadRequest,
  ImportCommitResult,
  ImportPreviewResult,
  ImportedFileInfo,
  LoadMetadataResult,
  LoadPlaylistResult,
  SaveResult,
} from "./types";

/**
 * 渲染层与主进程之间的 invoke 频道表：**频道名 → 入参元组 / 出参**。
 *
 * 这是频道事实的唯一来源：
 * - `src/preload/index.ts` 的 `invoke()` 按它约束 —— 写错频道名或参数编译不过；
 * - `src/main/index.ts` 的 handler 表按它约束 —— 漏注册一个频道编译不过；
 * - `scripts/verify-build.mjs` 按 `IPC_CHANNELS` 核对构建产物装齐了没有。
 *
 * 结果类型就是各 handler 实际返回的形状（例如 `metadata:update-video` 会多带 `source`），
 * 渲染层能看到的收窄版本在 `MediaApi` 里。
 */
export interface IpcChannels {
  "media:load-metadata": {
    args: [requestedPath?: string, persistedPath?: string, language?: string];
    result: LoadMetadataResult;
  };
  "media:choose-metadata": { args: [language?: string]; result: string | null };
  "media:choose-metadata-source": { args: [language?: string]; result: string | null };
  "media:probe-file": {
    args: [file: string];
    result: { ok: boolean; durationMs?: number; codec?: string; error?: string };
  };
  "media:open-in-folder": { args: [targetPath: string]; result: void };

  "browser:choose-download-dir": { args: [language?: string]; result: string | null };
  "browser:get-downloads-dir": { args: []; result: string };
  "browser:download-confirm": { args: [payload: ConfirmDownloadPayload]; result: SaveResult };
  "browser:download-cancel": { args: [downloadId: number]; result: void };
  "browser:download-from-webcontents": {
    args: [webContentsId: number, url: string];
    result: void;
  };
  "browser:open-external": { args: [url: string]; result: void };

  "metadata:choose-import-sources": { args: [language?: string]; result: string[] };
  "metadata:preview-import": {
    args: [paths: string[], existingIds: string[]];
    result: ImportPreviewResult;
  };
  "metadata:import": {
    args: [paths: string[], existingIds: string[]];
    result: ImportCommitResult;
  };
  "metadata:list-imports": { args: []; result: ImportedFileInfo[] };
  "metadata:remove-import": { args: [id: string]; result: SaveResult };
  "metadata:clear-imports": { args: []; result: SaveResult };
  "metadata:update-video": {
    args: [
      videoId: string,
      fields: Record<string, unknown>,
      loadedSource?: string,
      persistedPath?: string,
    ];
    result: { ok: boolean; source?: string; error?: string };
  };

  "thumbnail:generate": {
    args: [file: string, durationMs?: number];
    result: { ok: boolean; thumbnail?: string };
  };

  "playback:save-progress": { args: [updates: Record<string, number>]; result: SaveResult };
  "playback:load-progress": {
    args: [];
    result: { ok: boolean; progress: Record<string, number>; error?: string };
  };

  "video:relocate-file": { args: [videoId: string, hint: string]; result: string | null };

  "playlist:save": { args: [items: unknown[]]; result: SaveResult };
  "playlist:load": { args: []; result: LoadPlaylistResult };
}

export type IpcChannel = keyof IpcChannels;
export type IpcArgs<K extends IpcChannel> = IpcChannels[K]["args"];
export type IpcResult<K extends IpcChannel> = IpcChannels[K]["result"];

/** 主进程 → 渲染层的推送（不是 invoke 频道，不参与注册） */
export interface IpcEvents {
  "browser:download-intercept": DownloadRequest;
  "browser:download-progress": DownloadProgress;
}

export type IpcEvent = keyof IpcEvents;

/** 推送频道的运行时引用；主进程 `send` 与 preload 订阅都从这里取 */
export const IPC_EVENTS = {
  downloadIntercept: "browser:download-intercept",
  downloadProgress: "browser:download-progress",
} as const satisfies Record<string, IpcEvent>;

const CHANNELS = [
  "media:load-metadata",
  "media:choose-metadata",
  "media:choose-metadata-source",
  "media:probe-file",
  "media:open-in-folder",
  "browser:choose-download-dir",
  "browser:get-downloads-dir",
  "browser:download-confirm",
  "browser:download-cancel",
  "browser:download-from-webcontents",
  "browser:open-external",
  "metadata:choose-import-sources",
  "metadata:preview-import",
  "metadata:import",
  "metadata:list-imports",
  "metadata:remove-import",
  "metadata:clear-imports",
  "metadata:update-video",
  "thumbnail:generate",
  "playback:save-progress",
  "playback:load-progress",
  "video:relocate-file",
  "playlist:save",
  "playlist:load",
] as const satisfies readonly IpcChannel[];

/** 编译期护栏：`CHANNELS` 漏掉任何频道时这个类型解析为 never，赋值处直接报错 */
type AllChannelsCovered<T extends readonly IpcChannel[]> =
  Exclude<IpcChannel, T[number]> extends never ? T : never;

/** 全部 invoke 频道名：主进程按它注册，构建校验按它核对产物 */
export const IPC_CHANNELS: AllChannelsCovered<typeof CHANNELS> = CHANNELS;
