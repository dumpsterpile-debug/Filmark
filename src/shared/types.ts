export interface Video {
  id: string;
  file: string;
  playable?: boolean;
  thumbnail: string;
  title: string;
  durationMs: number;
  genre: string;
  tags: string[];
  artist: string[];
  character: string[];
  created: string;
  modified: string;
  extension: string;
}

export interface LoadMetadataResult {
  ok: boolean;
  source: string;
  count?: number;
  fileCount?: number;
  videos?: Video[];
  error?: string;
  errorCode?: "E_PATH_NOT_FOUND" | "E_NO_JSON" | "E_PARSE_FAILED";
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export interface LoadPlaylistResult {
  ok: boolean;
  items: Video[];
  error?: string;
}

export interface ImportPreviewResult {
  newCount: number;
  duplicateCount: number;
  failedFiles: { path: string; error: string }[];
  samples: { title: string; artist: string[]; file: string }[];
}

export interface ImportCommitResult {
  ok: boolean;
  imported?: number;
  skipped?: number;
  source?: string;
  error?: string;
}

export interface ImportedFileInfo {
  id: string;
  path: string;
  count: number;
  importedAt: string;
}

export interface DownloadRequest {
  downloadId: number;
  fileName: string;
  url: string;
}

export interface DownloadMeta {
  file: string;
  thumbnail: string;
  thumbnailUrl?: string;
  title: string;
  durationMs: number;
  genre: string;
  tags: string[];
  artist: string[];
  character: string[];
  created: string;
  modified: string;
  extension: string;
  video_id: string;
  url: string;
  file_name: string;
  file_extension: string;
}

export interface DownloadProgress {
  downloadId: number;
  fileName: string;
  receivedBytes: number;
  totalBytes: number;
  state: "progressing" | "completed" | "interrupted";
  savePath?: string;
}

/**
 * 下载确认载荷：渲染层表单 → 主进程。
 *
 * 来源字段随行，写入优先级（ADR-0002）与元数据编辑完全一致。
 */
export interface ConfirmDownloadPayload {
  downloadId: number;
  downloadPath?: string;
  /** 当前实际加载的元数据来源 */
  loadedSource?: string;
  /** 持久化的默认来源 */
  persistedPath?: string;
  meta: DownloadMeta;
}

export interface MediaApi {
  isDesktop: boolean;
  loadMetadata: (
    path?: string,
    persistedPath?: string,
    language?: string
  ) => Promise<LoadMetadataResult>;
  chooseMetadataFile: (language?: string) => Promise<string | null>;
  chooseMetadataSource: (language?: string) => Promise<string | null>;
  chooseDownloadDir: (language?: string) => Promise<string | null>;
  getDownloadsDir: () => Promise<string>;
  onDownloadIntercept: (callback: (request: DownloadRequest) => void) => () => void;
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void;
  confirmDownload: (payload: ConfirmDownloadPayload) => Promise<SaveResult>;
  cancelDownload: (downloadId: number) => Promise<void>;
  downloadFromWebContents: (webContentsId: number, url: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  chooseImportSources: (language?: string) => Promise<string[]>;
  previewImport: (paths: string[], existingIds: string[]) => Promise<ImportPreviewResult>;
  importMetadata: (paths: string[], existingIds: string[]) => Promise<ImportCommitResult>;
  listImports: () => Promise<ImportedFileInfo[]>;
  removeImport: (id: string) => Promise<SaveResult>;
  clearImports: () => Promise<SaveResult>;
  updateVideo: (
    videoId: string,
    fields: Record<string, unknown>,
    loadedSource?: string,
    persistedPath?: string
  ) => Promise<SaveResult>;
  generateThumbnail: (
    file: string,
    durationMs?: number
  ) => Promise<{
    ok: boolean;
    thumbnail?: string;
  }>;
  savePlaybackProgress: (updates: Record<string, number>) => Promise<SaveResult>;
  loadPlaybackProgress: () => Promise<{
    ok: boolean;
    progress: Record<string, number>;
    error?: string;
  }>;
  probeFile: (file: string) => Promise<{
    ok: boolean;
    durationMs?: number;
    codec?: string;
    error?: string;
  }>;
  relocateFile: (videoId: string, hint: string) => Promise<string | null>;
  openInFolder: (path: string) => Promise<void>;
  savePlaylist: (items: Video[]) => Promise<SaveResult>;
  loadPlaylist: () => Promise<LoadPlaylistResult>;
}
