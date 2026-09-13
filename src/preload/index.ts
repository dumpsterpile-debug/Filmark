import { contextBridge, ipcRenderer } from "electron";
import type { MediaApi } from "@shared/types";
import {
  IPC_EVENTS,
  type IpcArgs,
  type IpcChannel,
  type IpcEvent,
  type IpcEvents,
  type IpcResult,
} from "@shared/ipcChannels";

/**
 * 唯一的 invoke 调用点：频道名与入参/出参都来自通道表
 * （`src/shared/ipcChannels.ts`）—— 写错频道名或传错参数在这里就编译不过。
 */
function invoke<K extends IpcChannel>(channel: K, ...args: IpcArgs<K>): Promise<IpcResult<K>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<K>>;
}

/** 订阅主进程推送；返回取消订阅函数 */
function subscribe<K extends IpcEvent>(
  channel: K,
  callback: (payload: IpcEvents[K]) => void
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
    callback(payload as IpcEvents[K]);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const api: MediaApi = {
  isDesktop: true,
  loadMetadata: (path, persistedPath, language) =>
    invoke("media:load-metadata", path, persistedPath, language),
  chooseMetadataFile: (language) => invoke("media:choose-metadata", language),
  chooseMetadataSource: (language) => invoke("media:choose-metadata-source", language),
  chooseDownloadDir: (language) => invoke("browser:choose-download-dir", language),
  getDownloadsDir: () => invoke("browser:get-downloads-dir"),
  onDownloadIntercept: (callback) => subscribe(IPC_EVENTS.downloadIntercept, callback),
  onDownloadProgress: (callback) => subscribe(IPC_EVENTS.downloadProgress, callback),
  confirmDownload: (payload) => invoke("browser:download-confirm", payload),
  cancelDownload: (downloadId) => invoke("browser:download-cancel", downloadId),
  downloadFromWebContents: (webContentsId, url) =>
    invoke("browser:download-from-webcontents", webContentsId, url),
  openExternal: (url) => invoke("browser:open-external", url),
  chooseImportSources: (language) => invoke("metadata:choose-import-sources", language),
  previewImport: (paths, existingIds) => invoke("metadata:preview-import", paths, existingIds),
  importMetadata: (paths, existingIds) => invoke("metadata:import", paths, existingIds),
  listImports: () => invoke("metadata:list-imports"),
  removeImport: (id) => invoke("metadata:remove-import", id),
  clearImports: () => invoke("metadata:clear-imports"),
  updateVideo: (videoId, fields, loadedSource, persistedPath) =>
    invoke("metadata:update-video", videoId, fields, loadedSource, persistedPath),
  generateThumbnail: (file, durationMs) => invoke("thumbnail:generate", file, durationMs),
  savePlaybackProgress: (updates) => invoke("playback:save-progress", updates),
  loadPlaybackProgress: () => invoke("playback:load-progress"),
  probeFile: (file) => invoke("media:probe-file", file),
  relocateFile: (videoId, hint) => invoke("video:relocate-file", videoId, hint),
  openInFolder: (path) => invoke("media:open-in-folder", path),
  savePlaylist: (items) => invoke("playlist:save", items),
  loadPlaylist: () => invoke("playlist:load"),
};

contextBridge.exposeInMainWorld("api", api);
