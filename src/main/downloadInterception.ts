/**
 * 下载拦截状态机。
 *
 * `persist:browser` 会话里的下载会被拦下、弹表单、确认后再真正开始。
 * 这个「拦下 → 确认 → 放行」的过程有跨事件的状态，此前以 6 个模块级可变变量
 * 散落在 `index.ts` 里，既不能构造也不能测试。这里把它收成一个可构造的模块，
 * 对外只有三个动作：`handleDownload` / `confirm` / `cancel`。
 *
 * 与 Electron 的接触面收在一个结构化端口上（`DownloadItemLike` + 依赖），
 * 因此可以在 vitest 里用假端口跑完整流程，不需要真的发起一次下载。
 *
 * ⚠️ 一个容易踩的点：确认是**重新触发一次 will-download**，不是 resume 原下载 ——
 * 首次触发时进程已经把 DownloadItem 取消了。因此 `pendingConfirm` 是必需的，
 * 它把「表单里填了什么」带到下一次 will-download。
 */

import type { DownloadMeta, DownloadProgress, DownloadRequest } from "@shared/types";
import { resolveDownloadDir } from "@shared/browser";
import { sanitizeFileName } from "@shared/download";
import { safeResolve } from "./boundary";

/** 本模块用到的 DownloadItem 最小接口（Electron 的 DownloadItem 结构上满足它） */
export interface DownloadItemLike {
  getURL(): string;
  getFilename(): string;
  getReceivedBytes(): number;
  getTotalBytes(): number;
  getSavePath(): string;
  isPaused(): boolean;
  setSavePath(path: string): void;
  cancel(): void;
  on(event: "updated", listener: () => void): unknown;
  on(event: "done", listener: (event: unknown, state: string) => void): unknown;
}

/**
 * 拦截模块的输入：只要求它真正用到的字段。
 * 完整表单走 `ConfirmDownloadPayload`（`@shared/types`），结构上满足这里。
 */
export interface DownloadConfirmInput {
  downloadId: number;
  downloadPath?: string;
  /** 渲染层当前实际加载的元数据来源（ADR-0002），随下载一起带给写入模块 */
  loadedSource?: string;
  persistedPath?: string;
  meta: { file_name?: string; file_extension?: string };
}

/** 下载完成后写元数据时用的来源上下文 */
export interface DownloadWriteContext {
  loadedSource?: string;
  persistedPath?: string;
}

export interface DownloadInterceptionDeps {
  /** 默认下载目录，来自 `app.getPath("downloads")` */
  downloadsDir(): string;
  /** 确保目录存在（落点目录可能尚未创建） */
  ensureDir(dir: string): void;
  /** 在该会话里触发一次 guest 下载；会再次触发 will-download */
  triggerGuestDownload(url: string): void;
  /** 首次触发时通知渲染层弹表单 */
  requestMeta(request: DownloadRequest): void;
  /** 进度上报 */
  reportProgress(progress: DownloadProgress): void;
  /** 下载完成：补全元数据、生成缩略图并落盘 */
  complete(meta: DownloadMeta, savePath: string, context: DownloadWriteContext): Promise<void>;
}

export type HandleDownloadOutcome = "confirmed" | "intercepted";

interface PendingConfirm {
  /** 这一次下载的 id：拦截通知、进度上报、取消都用它，全程不变 */
  downloadId: number;
  url: string;
  downloadPath?: string;
  loadedSource?: string;
  persistedPath?: string;
  meta: { file_name?: string; file_extension?: string };
}

interface TrackedDownload {
  item: DownloadItemLike;
  meta: DownloadMeta;
  context: DownloadWriteContext;
}

export class DownloadInterception {
  private seq = 0;
  private pendingConfirm: PendingConfirm | null = null;
  private readonly tracked = new Map<number, TrackedDownload>();

  constructor(private readonly deps: DownloadInterceptionDeps) {}

  /**
   * 处理一次 `will-download`。
   *
   * 返回 `"intercepted"` 表示这是首次触发：已取消该下载并请求表单，
   * **调用方必须 `event.preventDefault()`**。返回 `"confirmed"` 表示这是用户确认后
   * 重新触发的下载：已设置落点并开始跟踪，调用方不要阻止它。
   */
  handleDownload(item: DownloadItemLike): HandleDownloadOutcome {
    const url = item.getURL();
    const confirmed = this.pendingConfirm;
    if (confirmed && confirmed.url === url) {
      this.pendingConfirm = null;
      this.startTracked(confirmed.downloadId, item, confirmed.meta as DownloadMeta, {
        ...(confirmed.loadedSource !== undefined ? { loadedSource: confirmed.loadedSource } : {}),
        ...(confirmed.persistedPath !== undefined
          ? { persistedPath: confirmed.persistedPath }
          : {}),
      });
      this.applySavePath(item, confirmed);
      return "confirmed";
    }

    // 首次触发：取消真实下载（阻止它开始），改为弹表单
    try {
      item.cancel();
    } catch {
      /* 可能已被取消 */
    }
    const downloadId = ++this.seq;
    this.pendingConfirm = { downloadId, url, meta: {} };
    this.deps.requestMeta({ downloadId, fileName: item.getFilename(), url });
    return "intercepted";
  }

  /**
   * 表单确认：记住落点后重新触发该 URL 的下载。
   * 找不到待确认的下载时返回 false，调用方据此回报错误。
   */
  confirm(payload: DownloadConfirmInput): boolean {
    const confirmed = this.pendingConfirm;
    if (!confirmed) return false;
    this.pendingConfirm = {
      downloadId: confirmed.downloadId,
      url: confirmed.url,
      meta: payload.meta,
      ...(payload.downloadPath !== undefined ? { downloadPath: payload.downloadPath } : {}),
      ...(payload.loadedSource !== undefined ? { loadedSource: payload.loadedSource } : {}),
      ...(payload.persistedPath !== undefined ? { persistedPath: payload.persistedPath } : {}),
    };
    this.deps.triggerGuestDownload(confirmed.url);
    return true;
  }

  /** 取消：丢掉待确认状态，并取消已在跟踪的下载（若存在） */
  cancel(downloadId: number): void {
    this.pendingConfirm = null;
    const entry = this.tracked.get(downloadId);
    if (!entry) return;
    entry.item.cancel();
    this.tracked.delete(downloadId);
  }

  private startTracked(
    downloadId: number,
    item: DownloadItemLike,
    meta: DownloadMeta,
    context: DownloadWriteContext
  ): void {
    this.tracked.set(downloadId, { item, meta, context });
    this.watch(downloadId, item);
  }

  /**
   * 确认后的下载：按表单给出的目录、文件名与扩展名算出最终落点。
   * 文件名不安全时取消该下载（不落到工作目录之外的路径）。
   */
  private applySavePath(item: DownloadItemLike, confirmed: PendingConfirm): void {
    try {
      const dir = resolveDownloadDir(confirmed.downloadPath ?? null, this.deps.downloadsDir());
      this.deps.ensureDir(dir);
      const extension = confirmed.meta.file_extension
        ? `.${confirmed.meta.file_extension.replace(/^\./, "")}`
        : "";
      const fileName = `${sanitizeFileName(confirmed.meta.file_name ?? "download")}${extension}`;
      const finalPath = safeResolve(dir, fileName);
      if (!finalPath) {
        console.warn("[browser] rejected unsafe download path:", fileName);
        item.cancel();
        return;
      }
      item.setSavePath(finalPath);
    } catch (error) {
      console.warn("[browser] set final save path failed:", error);
    }
  }

  private watch(downloadId: number, item: DownloadItemLike): void {
    const emit = (state: DownloadProgress["state"], savePath?: string): void => {
      this.deps.reportProgress({
        downloadId,
        fileName: item.getFilename(),
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes(),
        state,
        ...(savePath !== undefined ? { savePath } : {}),
      });
    };

    item.on("updated", () => {
      emit(item.isPaused() ? "interrupted" : "progressing");
    });
    item.on("done", (_event, state) => {
      const savePath = item.getSavePath();
      emit(state === "completed" ? "completed" : "interrupted", savePath);
      const entry = this.tracked.get(downloadId);
      this.tracked.delete(downloadId);
      if (state === "completed" && entry) {
        void this.deps.complete(entry.meta, savePath, entry.context);
      }
    });
  }
}
