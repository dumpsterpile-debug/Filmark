import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  session,
  shell,
  webContents,
} from "electron";
import { createReadStream, mkdirSync } from "fs";
import { readFile, readdir, stat, mkdir, writeFile, unlink, rm } from "fs/promises";
import { join, resolve } from "path";
import type { ConfirmDownloadPayload, DownloadMeta, ImportedFileInfo, Video } from "@shared/types";
import {
  IPC_CHANNELS,
  IPC_EVENTS,
  type IpcArgs,
  type IpcChannel,
  type IpcResult,
} from "@shared/ipcChannels";
import { normalizeVideos } from "@shared/videos";
import {
  metadataErrorCode,
  pickMetadataTarget,
  type MetadataErrorCode,
} from "@shared/metadataSource";
import { computeImportPreview, importFileName, type ImportSourceParse } from "@shared/imports";
import {
  appendVideoRecord,
  downloadMetaToRecord,
  updateVideoRecord,
  writeTargets,
} from "@shared/metadataWrite";
import { metadataFilePort, readJsonArray } from "./metadataFs";
import { DownloadInterception, type DownloadWriteContext } from "./downloadInterception";
import { downloadRemoteThumbnail, generateThumbnail, setThumbnailCacheDir } from "./thumbnail";
import { probeDurationMs, probeVideoCodec } from "./probe";
import { mergeProgress } from "@shared/playback";
import { applyFileRelocations } from "@shared/videoPlayability";
import { parsePosterUrl } from "@shared/poster";
import { isAllowedMediaPath } from "./mediaPolicy";
import { defaultBrowserPolicy } from "@shared/browserPolicy";
import { appOrigins, assertTrustedSender, isPathInside, isSafeExternalUrl } from "./boundary";
import { APP_DATA_DIR_NAME, APP_DISPLAY_NAME, APP_ID } from "@shared/appIdentity";
import { migrateLegacyUserData } from "./userDataMigration";

/** 默认元数据目录：开发环境为项目内 src/public，打包后为 resources/public */
function defaultMetadataDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "public")
    : join(app.getAppPath(), "src", "public");
}

/** 导入元数据存储目录：用户数据目录下 metadata/imported */
function importedMetadataDir(): string {
  return join(app.getPath("userData"), "metadata", "imported");
}

function fileRelocationsPath(): string {
  return join(app.getPath("userData"), "file-relocations.json");
}

async function loadFileRelocations(): Promise<Record<string, string>> {
  try {
    const text = await readFile(fileRelocationsPath(), "utf8");
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** 解析单个导入来源（文件或目录），返回逐文件解析结果 */
async function parseImportSources(target: string): Promise<ImportSourceParse[]> {
  try {
    const info = await stat(target);
    if (info.isDirectory()) {
      const files = (await readdir(target))
        .filter((f) => f.toLowerCase().endsWith(".json"))
        .sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
      if (files.length === 0) {
        return [{ path: target, ok: false, error: "no json files" }];
      }
      const results: ImportSourceParse[] = [];
      for (const file of files) {
        const full = join(target, file);
        const parsed = await readJsonArray(full);
        if (parsed.kind === "array") {
          results.push({ path: full, ok: true, raw: parsed.data });
        } else {
          results.push({
            path: full,
            ok: false,
            error: parsed.kind === "not-array" ? "not an array" : "parse error",
          });
        }
      }
      return results;
    }
    const parsed = await readJsonArray(target);
    if (parsed.kind === "array") {
      return [{ path: target, ok: true, raw: parsed.data }];
    }
    return [
      {
        path: target,
        ok: false,
        error: parsed.kind === "not-array" ? "not an array" : "parse error",
      },
    ];
  } catch {
    return [{ path: target, ok: false, error: "path not found" }];
  }
}

/** 读取单个 JSON 文件，或目录下所有 JSON 并拼接为原始记录数组 */
async function collectMetadata(target: string): Promise<{
  raw: unknown[];
  source: string;
  fileCount: number;
  errorCode?: MetadataErrorCode;
}> {
  try {
    const info = await stat(target);
    if (info.isDirectory()) {
      const files = (await readdir(target))
        .filter((f) => f.toLowerCase().endsWith(".json"))
        .sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
      const raw: unknown[] = [];
      let fileCount = 0;
      let parsedOtherCount = 0;
      for (const file of files) {
        const result = await readJsonArray(join(target, file));
        if (result.kind === "array") {
          raw.push(...result.data);
          fileCount += 1;
        } else if (result.kind === "not-array") {
          parsedOtherCount += 1;
        }
      }
      const errorCode = metadataErrorCode({
        exists: true,
        isDirectory: true,
        jsonCount: files.length,
        parsedArrayCount: fileCount,
        parsedOtherCount,
      });
      return {
        raw,
        source: target,
        fileCount,
        ...(errorCode ? { errorCode } : {}),
      };
    }
    const result = await readJsonArray(target);
    const errorCode = metadataErrorCode({
      exists: true,
      isDirectory: false,
      jsonCount: 1,
      parsedArrayCount: result.kind === "array" ? 1 : 0,
      parsedOtherCount: result.kind === "not-array" ? 1 : 0,
    });
    return {
      raw: result.kind === "array" ? result.data : [],
      source: target,
      fileCount: result.kind === "array" ? 1 : 0,
      ...(errorCode ? { errorCode } : {}),
    };
  } catch {
    return {
      raw: [],
      source: target,
      fileCount: 0,
      errorCode: "E_PATH_NOT_FOUND",
    };
  }
}

function dedupeById(videos: Video[]): Video[] {
  const seen = new Set<string>();
  return videos.filter((v) => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });
}

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: "media",
    privileges: {
      standard: true,
      secure: true,
      stream: true,
    },
  },
]);

/** 注册 media:// 协议：把 URL 里的本地绝对路径安全地流式返回（支持 Range，供视频拖动进度条） */
function registerMediaProtocol(): void {
  protocol.handle("media", async (request) => {
    try {
      const url = new URL(request.url);
      const filePath = decodeURIComponent(url.pathname.replace(/^\//, ""));
      if (!filePath || !/^[a-zA-Z]:[\\/]/.test(filePath)) {
        return new Response("invalid path", { status: 400 });
      }

      const info = await stat(filePath);
      if (!info.isFile()) return new Response("not a file", { status: 404 });
      if (!isAllowedMediaPath(filePath)) {
        return new Response("not allowed", { status: 404 });
      }

      const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
      const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
      const range = request.headers.get("range");

      if (range) {
        const match = /bytes=(\d*)-(\d*)/.exec(range);
        const start = match && match[1] ? parseInt(match[1], 10) : 0;
        const end = match && match[2] ? parseInt(match[2], 10) : info.size - 1;
        if (start > end || start >= info.size) {
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${info.size}` },
          });
        }
        const stream = createReadStream(filePath, { start, end });
        return new Response(stream as unknown as never, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(end - start + 1),
            "Accept-Ranges": "bytes",
            "Content-Range": `bytes ${start}-${end}/${info.size}`,
            "Cache-Control": "no-cache",
          },
        });
      }

      const stream = createReadStream(filePath);
      return new Response(stream as unknown as never, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(info.size),
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-cache",
        },
      });
    } catch {
      return new Response("not found", { status: 404 });
    }
  });
}

let lastDownloadUrl = "";
let lastDownloadAt = 0;
let mainWindow: BrowserWindow | null = null;
const browserPolicy = defaultBrowserPolicy();

/** 在 persist:browser 会话内找到 webview guest 并触发下载（同一 URL 2 秒内去重，避免 DOM 与主进程双触发） */
function initiateGuestDownload(url: string): void {
  const now = Date.now();
  if (url === lastDownloadUrl && now - lastDownloadAt < 2000) return;
  lastDownloadUrl = url;
  lastDownloadAt = now;
  const guest = webContents
    .getAllWebContents()
    .find(
      (c) => c.getType() === "webview" && c.session === session.fromPartition("persist:browser")
    );
  console.log("[browser] initiate-guest-download:", url, Boolean(guest));
  guest?.downloadURL(url);
}

/**
 * 下载拦截状态机（实现见 `downloadInterception.ts`）。
 *
 * 状态（待确认的表单、已被放行的下载、元数据来源）都在实例内部，
 * 与 Electron 的接触面收在下面这几个依赖上 —— 因此状态机本身可以在测试里
 * 用假端口跑完整流程，不需要真的发起一次下载。
 */
const downloads = new DownloadInterception({
  downloadsDir: () => app.getPath("downloads"),
  ensureDir: (dir) => mkdirSync(dir, { recursive: true }),
  triggerGuestDownload: initiateGuestDownload,
  requestMeta: (request) => {
    const target = mainWindow ?? BrowserWindow.getAllWindows()[0];
    if (!target) {
      console.warn("[browser] no window to send intercept");
      return;
    }
    target.webContents.send(IPC_EVENTS.downloadIntercept, request);
    console.log("[browser] intercept sent to renderer:", request.downloadId);
  },
  reportProgress: (progress) => {
    const win = mainWindow ?? BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) win.webContents.send(IPC_EVENTS.downloadProgress, progress);
  },
  complete: (meta, savePath, context) => handleDownloadCompleted(meta, savePath, context),
});

/**
 * 拦下 persist:browser 会话的下载：首次触发时阻止它开始并弹表单，
 * 用户确认后重新触发的那一次直接放行。
 */
function registerDownloadInterception(): void {
  const browserSession = session.fromPartition("persist:browser");
  browserSession.on("will-download", (event, item) => {
    console.log("[browser] will-download:", item.getURL(), item.getFilename());
    if (downloads.handleDownload(item) === "intercepted") event.preventDefault();
  });
}

/** US-708/709/710：下载完成后补全 file 元数据、生成缩略图并写入元数据 */
async function handleDownloadCompleted(
  meta: DownloadMeta,
  savePath: string,
  context: DownloadWriteContext
): Promise<void> {
  try {
    const info = await stat(savePath);
    const completed: DownloadMeta = {
      ...meta,
      file: savePath,
      extension: savePath.slice(savePath.lastIndexOf(".") + 1).toLowerCase(),
      created: new Date(info.birthtime).toISOString(),
      modified: new Date(info.mtime).toISOString(),
    };
    if (!completed.durationMs) {
      completed.durationMs = await probeDurationMs(savePath);
    }
    const posterUrl = meta.thumbnailUrl ? parsePosterUrl(meta.thumbnailUrl) : "";
    const safePosterUrl =
      posterUrl && browserPolicy.decideFetch(posterUrl).action === "allow" ? posterUrl : "";
    const thumb = safePosterUrl
      ? ((await downloadRemoteThumbnail(safePosterUrl)) ??
        (await generateThumbnail(savePath, completed.durationMs)))
      : await generateThumbnail(savePath, completed.durationMs);
    if (thumb) completed.thumbnail = thumb;
    console.log("[browser] download completed meta:", completed.file, completed.title);
    await appendSingleMeta(completed, context);
  } catch (error) {
    console.warn("[browser] handle download completed failed:", error);
  }
}

/**
 * US-710：把下载完成的记录写进元数据。
 *
 * 目标顺序与编辑路径完全一致（同一个 `writeTargets`），因此不会再出现
 * 「下载写到了默认目录、而用户看的是另一个库」这类分歧。
 */
async function appendSingleMeta(
  meta: DownloadMeta,
  context: DownloadWriteContext
): Promise<{ ok: boolean; source: string }> {
  const defaultDir = defaultMetadataDir();
  const importedDir = importedMetadataDir();
  // 导入存储是最后一档兜底：先确保它存在，否则该目标在解析阶段就会失败
  try {
    await mkdir(importedDir, { recursive: true });
  } catch (error) {
    console.warn("[browser] could not prepare imported store:", error);
  }

  const result = await appendVideoRecord(
    {
      record: downloadMetaToRecord(meta),
      targets: writeTargets({
        loadedSource: context.loadedSource,
        persistedPath: context.persistedPath,
        defaultDir,
        importedDir,
      }),
    },
    metadataFilePort
  );

  if (!result.ok) {
    console.warn("[browser] append meta failed:", result.error);
    return { ok: false, source: "" };
  }
  console.log("[browser] meta appended to:", result.source);
  return { ok: true, source: result.source };
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: "#0f0f0f",
    show: false,
    autoHideMenuBar: true,
    title: APP_DISPLAY_NAME,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
      spellcheck: false,
    },
  });

  win.once("ready-to-show", () => win.show());
  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  if (process.env["ELECTRON_RENDERER_URL"]) {
    void win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return win;
}

/** main 侧的频道 → handler 表。缺一个频道、写错名字或签名对不上都在这里编译不过 */
type IpcHandlers = {
  [K in IpcChannel]: (
    event: Electron.IpcMainInvokeEvent,
    ...args: IpcArgs<K>
  ) => IpcResult<K> | Promise<IpcResult<K>>;
};

/** 注册循环里用的宽签名：泛型在 for 循环里无法保持键与值的关联（见循环处注释） */
type IpcHandler = (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown;

function registerIpc(): void {
  const ALLOWED_ORIGINS = appOrigins();
  const trusted = (event: Electron.IpcMainInvokeEvent): boolean =>
    assertTrustedSender(event, ALLOWED_ORIGINS);

  const handlers: IpcHandlers = {
    "media:load-metadata": async (
      _event,
      requestedPath?: string,
      persistedPath?: string,
      language?: string
    ) => {
      const defaultDir = defaultMetadataDir();
      const target = pickMetadataTarget({
        requestedPath,
        persistedPath,
        defaultDir,
      });
      const [defaultResult, importedResult] = await Promise.all([
        collectMetadata(target),
        collectMetadata(importedMetadataDir()),
      ]);
      const raw = [...defaultResult.raw, ...importedResult.raw];
      const source = defaultResult.source;
      const fileCount = defaultResult.fileCount + importedResult.fileCount;
      const errorCode = defaultResult.errorCode;
      const videos = dedupeById(
        applyFileRelocations(normalizeVideos(raw), await loadFileRelocations())
      );
      if (videos.length === 0) {
        return {
          ok: false as const,
          source,
          errorCode: errorCode ?? ("E_NO_JSON" as const),
          error:
            language === "en"
              ? `No usable JSON metadata found: ${source}`
              : `未找到可用的 JSON 元数据：${source}`,
        };
      }
      return { ok: true as const, source, count: videos.length, fileCount, videos };
    },

    "media:choose-metadata": async (_event, language?: string) => {
      const result = await dialog.showOpenDialog({
        title:
          language === "en" ? "Choose video metadata file (JSON)" : "选择视频元数据文件 (JSON)",
        properties: ["openFile"],
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
    },

    "media:choose-metadata-source": async (_event, language?: string) => {
      const result = await dialog.showOpenDialog({
        title:
          language === "en"
            ? "Choose metadata source (JSON file or folder)"
            : "选择元数据源（JSON 文件或目录）",
        properties: ["openFile", "openDirectory"],
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
    },

    "browser:choose-download-dir": async (_event, language?: string) => {
      const result = await dialog.showOpenDialog({
        title: language === "en" ? "Choose default download folder" : "选择默认下载目录",
        properties: ["openDirectory", "createDirectory"],
      });
      return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
    },

    "browser:get-downloads-dir": () => app.getPath("downloads"),

    "browser:download-confirm": async (_event, payload: ConfirmDownloadPayload) => {
      if (!trusted(_event)) return { ok: false as const, error: "unauthorized" };
      // 表单确认：重新触发被拦下的下载，由下一次 will-download 放行
      return downloads.confirm(payload)
        ? { ok: true as const }
        : { ok: false as const, error: "download not found" };
    },

    "browser:download-cancel": (_event, downloadId: number) => {
      downloads.cancel(downloadId);
    },

    "browser:download-from-webcontents": (_event, webContentsId: number, url: string) => {
      console.log("[browser] download-from-webcontents:", webContentsId, url);
      // 提取面板给出的直链常位于媒体 CDN，故不做域名白名单，只允许 http(s)；
      // 真正落盘仍需经过 will-download 拦截与元数据表单确认。
      if (!isSafeExternalUrl(url)) {
        console.warn("[browser] rejected non-http(s) download url");
        return;
      }
      const wc = webContents.fromId(webContentsId);
      if (wc && wc.session === session.fromPartition("persist:browser")) {
        wc.downloadURL(url);
      } else {
        initiateGuestDownload(url);
      }
    },

    "browser:open-external": (_event, url: string) => {
      if (!trusted(_event)) return;
      if (isSafeExternalUrl(url)) void shell.openExternal(url);
    },

    "metadata:choose-import-sources": async (_event, language?: string) => {
      const result = await dialog.showOpenDialog({
        title:
          language === "en"
            ? "Choose metadata files or a folder to import"
            : "选择要导入的元数据文件或目录",
        properties: ["openFile", "openDirectory", "multiSelections"],
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      return result.canceled ? [] : result.filePaths;
    },

    "metadata:preview-import": async (_event, paths: string[], existingIds: string[]) => {
      const sources: ImportSourceParse[] = [];
      for (const p of paths) {
        sources.push(...(await parseImportSources(p)));
      }
      return computeImportPreview(sources, new Set(existingIds));
    },

    "metadata:import": async (_event, paths: string[], existingIds: string[]) => {
      try {
        const sources: ImportSourceParse[] = [];
        for (const p of paths) {
          sources.push(...(await parseImportSources(p)));
        }
        const preview = computeImportPreview(sources, new Set(existingIds));
        const dir = importedMetadataDir();
        await mkdir(dir, { recursive: true });
        const target = join(dir, importFileName(new Date()));
        const seen = new Set(existingIds);
        const newRaw: unknown[] = [];
        for (const source of sources) {
          if (!source.ok) continue;
          for (const video of normalizeVideos(source.raw ?? [])) {
            if (!seen.has(video.id)) {
              seen.add(video.id);
              newRaw.push(video);
            }
          }
        }
        await writeFile(target, JSON.stringify(newRaw, null, 2), "utf8");
        return {
          ok: true as const,
          imported: preview.newCount,
          skipped: preview.duplicateCount,
          source: target,
        };
      } catch (error) {
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    "metadata:list-imports": async (): Promise<ImportedFileInfo[]> => {
      const dir = importedMetadataDir();
      try {
        const files = (await readdir(dir))
          .filter((f) => f.toLowerCase().endsWith(".json"))
          .sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
        const out: ImportedFileInfo[] = [];
        for (const file of files) {
          const full = join(dir, file);
          const parsed = await readJsonArray(full);
          const info = await stat(full);
          out.push({
            id: full,
            path: full,
            count: parsed.kind === "array" ? parsed.data.length : 0,
            importedAt: info.mtime.toISOString(),
          });
        }
        return out;
      } catch {
        return [];
      }
    },

    "metadata:remove-import": async (_event, id: string) => {
      if (!trusted(_event)) return { ok: false as const, error: "unauthorized" };
      try {
        const dir = importedMetadataDir();
        const target = resolve(id);
        if (!isPathInside(dir, target)) {
          return { ok: false as const, error: "invalid path" };
        }
        await unlink(target);
        return { ok: true as const };
      } catch (error) {
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    "metadata:clear-imports": async () => {
      try {
        const dir = importedMetadataDir();
        await rm(dir, { recursive: true, force: true });
        return { ok: true as const };
      } catch (error) {
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    "thumbnail:generate": async (_event, file: string, durationMs?: number) => {
      if (!trusted(_event)) return { ok: false as const };
      const thumb = await generateThumbnail(file, durationMs ?? 0);
      return thumb ? { ok: true as const, thumbnail: thumb } : { ok: false as const };
    },

    "playback:save-progress": async (_event, updates: Record<string, number>) => {
      try {
        const file = join(app.getPath("userData"), "playback-progress.json");
        let existing: Record<string, number> = {};
        try {
          const text = await readFile(file, "utf8");
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === "object") existing = parsed;
        } catch {
          /* 首次写入 */
        }
        const next = mergeProgress(existing, updates);
        await writeFile(file, JSON.stringify(next, null, 2), "utf8");
        return { ok: true as const };
      } catch (error) {
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    "playback:load-progress": async () => {
      try {
        const text = await readFile(
          join(app.getPath("userData"), "playback-progress.json"),
          "utf8"
        );
        const parsed = JSON.parse(text);
        return {
          ok: true as const,
          progress: parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {},
        };
      } catch {
        return { ok: true as const, progress: {} };
      }
    },

    "media:probe-file": async (_event, file: string) => {
      if (!trusted(_event)) return { ok: false as const, error: "unauthorized" };
      try {
        await stat(file);
      } catch {
        return { ok: false as const, error: "not-found" };
      }
      const durationMs = await probeDurationMs(file);
      const codec = await probeVideoCodec(file);
      return { ok: true as const, durationMs, codec };
    },

    "video:relocate-file": async (_event, videoId: string, hint: string) => {
      const result = await dialog.showOpenDialog({
        title: "选择该视频对应的本地文件",
        properties: ["openFile"],
        filters: [{ name: "Video", extensions: ["mp4", "m4v", "webm", "mkv", "mov", "avi"] }],
        ...(hint ? { defaultPath: hint } : {}),
      });
      if (result.canceled || !result.filePaths[0]) return null;
      const target = result.filePaths[0];
      const relocations = await loadFileRelocations();
      relocations[videoId] = target;
      await writeFile(fileRelocationsPath(), JSON.stringify(relocations, null, 2), "utf8");
      return target;
    },

    "media:open-in-folder": (_event, targetPath: string) => {
      if (!trusted(_event)) return;
      shell.showItemInFolder(targetPath);
    },

    "metadata:update-video": async (
      _event,
      videoId: string,
      fields: Record<string, unknown>,
      loadedSource?: string,
      persistedPath?: string
    ) => {
      if (!trusted(_event)) return { ok: false as const, error: "unauthorized" };
      const defaultDir = defaultMetadataDir();
      // 目标顺序与下载路径完全一致（同一个 writeTargets，ADR-0002）
      const targets = writeTargets({
        loadedSource,
        persistedPath,
        defaultDir,
        importedDir: importedMetadataDir(),
      });

      const result = await updateVideoRecord({ videoId, fields, targets }, metadataFilePort);
      if (!result.ok) {
        console.warn("[metadata] update failed:", videoId, result.error);
        return { ok: false as const, error: result.error };
      }
      console.log(`[metadata] updated video ${videoId} in ${result.source}`);
      return { ok: true as const, source: result.source };
    },

    "playlist:save": async (_event, items: unknown[]) => {
      if (!trusted(_event)) return { ok: false as const, error: "unauthorized" };
      try {
        const dir = app.getPath("userData");
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, "playlist.json"), JSON.stringify(items, null, 2), "utf8");
        return { ok: true as const };
      } catch (error) {
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    "playlist:load": async () => {
      try {
        const text = await readFile(join(app.getPath("userData"), "playlist.json"), "utf8");
        const data = JSON.parse(text);
        return { ok: true as const, items: Array.isArray(data) ? data : [] };
      } catch {
        return { ok: true as const, items: [] };
      }
    },
  };

  for (const channel of IPC_CHANNELS) {
    // TS 无法在循环里保持「键 ↔ handler 参数」的关联，这里统一收窄一次
    ipcMain.handle(channel, handlers[channel] as unknown as IpcHandler);
  }

  /** 宿主窗口层面兜底：webview 内 target="_blank" 请求也会先经过这里 */
  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      const downloadDecision = browserPolicy.decideDownload(url);
      if (contents.session === session.fromPartition("persist:browser")) {
        if (downloadDecision.action === "intercept") {
          initiateGuestDownload(url);
        }
      } else {
        if (downloadDecision.action === "intercept") {
          contents.downloadURL(url);
        } else if (browserPolicy.decideExternal(url).action === "allow") {
          void shell.openExternal(url);
        }
      }
      return { action: "deny" };
    });
  });
}

/**
 * 把用户数据目录钉死在 APP_DATA_DIR_NAME 上。
 *
 * 必须在任何 `app.getPath("userData")` 之前执行 —— 包括单实例锁（锁文件就位于
 * userData 下），否则开发态与打包态会因为 productName 不同而落到两个目录。
 */
app.setName(APP_DATA_DIR_NAME);

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app
    .whenReady()
    .then(async () => {
      // 一次性把旧显示名 / 旧包名目录下的数据并入当前目录；失败只告警，不阻塞启动
      const migrated = await migrateLegacyUserData();
      if (migrated.length > 0) {
        console.log("[migrate] userData entries migrated:", migrated.join(", "));
      }

      // 与安装器写入快捷方式的 AppUserModelId 保持一致，否则任务栏固定/分组会分裂
      app.setAppUserModelId(APP_ID);

      registerMediaProtocol();
      registerIpc();
      registerDownloadInterception();
      setThumbnailCacheDir(join(app.getPath("userData"), "thumbnails"));
      const win = createWindow();

      if (!app.isPackaged && process.env.QA_SHOTS_DIR) {
        void import("./qaShots.js").then(({ runQaShots }) =>
          runQaShots(win, process.env.QA_SHOTS_DIR as string)
        );
      }

      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    })
    .catch((error) => {
      // 启动链上还没有可用窗口，只记录：让异常可见，而不是变成 unhandled rejection
      console.error("[startup] failed:", error);
    });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
