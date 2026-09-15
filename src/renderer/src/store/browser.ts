import type { DownloadMeta, DownloadProgress, DownloadRequest } from "@shared/types";
import type { ExtractResult } from "@shared/siteAdapters";
import { isValidHttpUrl } from "@shared/browser";
import i18n from "@/i18n";
import { getApi } from "@/lib/api";
import type { SliceCreator } from "./slice";

/** 内置浏览器与下载：默认页、下载目录、站点提取开关、下载拦截的两端 */
export interface BrowserSlice {
  defaultWebUrl: string;
  downloadPath: string;
  siteExtractEnabled: boolean;
  /**
   * 当前页面最近一次站点提取结果 —— 提取面板写入，元数据弹窗读取。
   *
   * 一次提取同时服务两处：面板据此列出可下载媒体，弹窗据此预填标题 / 封面 / 标签，
   * 于是「从面板点下载」与「元数据表单」共用同一份页面事实，不必各抓一遍。
   */
  extractResult: ExtractResult | null;
  downloadRequest: DownloadRequest | null;
  downloadProgress: DownloadProgress | null;

  setDefaultWebUrl: (url: string) => void;
  resetDefaultWebUrl: () => void;
  setDownloadPath: (path: string) => void;
  resetDownloadPath: () => void;
  setSiteExtractEnabled: (enabled: boolean) => void;
  setExtractResult: (result: ExtractResult | null) => void;
  confirmDownload: (meta: DownloadMeta) => Promise<void>;
  cancelDownload: () => void;
  /** 绑定主进程的下载事件；重复调用先解绑再绑定，不会叠加监听 */
  attachDownloadListeners: () => void;
}

/** 下载事件订阅的卸载句柄；重绑之前先全部解绑，避免 init 重入时叠加监听 */
let downloadUnsubscribers: (() => void)[] = [];

function disposeDownloadListeners(): void {
  for (const off of downloadUnsubscribers) off();
  downloadUnsubscribers = [];
}

export const createBrowserSlice: SliceCreator<BrowserSlice> = (set, get) => ({
  defaultWebUrl: "",
  downloadPath: "",
  siteExtractEnabled: true,
  extractResult: null,
  downloadRequest: null,
  downloadProgress: null,

  setDefaultWebUrl: (url) => {
    if (!isValidHttpUrl(url)) {
      get().toast(i18n.t("toast.webUrlInvalid"));
      return;
    }
    set({ defaultWebUrl: url.trim() });
    get().toast(i18n.t("toast.webUrlSaved"));
  },

  resetDefaultWebUrl: () => {
    set({ defaultWebUrl: "" });
    get().toast(i18n.t("toast.webUrlReset"));
  },

  setDownloadPath: (path) => {
    const trimmed = path.trim();
    if (!trimmed) return;
    set({ downloadPath: trimmed });
    get().toast(i18n.t("toast.downloadDirSet"));
  },

  resetDownloadPath: () => {
    set({ downloadPath: "" });
    get().toast(i18n.t("toast.downloadDirReset"));
  },

  setSiteExtractEnabled: (enabled) => set({ siteExtractEnabled: enabled }),

  setExtractResult: (result) => set({ extractResult: result }),

  confirmDownload: async (meta) => {
    const { downloadRequest, downloadPath, defaultMetadataPath, metadataPath } = get();
    const api = getApi();
    if (!api || !downloadRequest) return;
    const result = await api.confirmDownload({
      downloadId: downloadRequest.downloadId,
      ...(downloadPath ? { downloadPath } : {}),
      // 把当前实际加载来源一并交给主进程：下载写入与编辑写入共用同一优先级
      ...(metadataPath ? { loadedSource: metadataPath } : {}),
      ...(defaultMetadataPath ? { persistedPath: defaultMetadataPath } : {}),
      meta,
    });
    if (result.ok) {
      set({ downloadRequest: null });
    } else {
      get().toast(i18n.t("toast.downloadConfirmFailed", { error: result.error ?? "" }));
    }
  },

  cancelDownload: () => {
    const { downloadRequest, downloadProgress } = get();
    const downloadId = downloadRequest?.downloadId ?? downloadProgress?.downloadId;
    const api = getApi();
    if (!api || downloadId == null) return;
    void api.cancelDownload(downloadId);
    set({ downloadRequest: null, downloadProgress: null });
  },

  attachDownloadListeners: () => {
    disposeDownloadListeners();
    const api = getApi();
    if (!api) return;
    downloadUnsubscribers = [
      api.onDownloadIntercept((request) => {
        console.log("[store] download-intercept received:", request);
        set({ downloadRequest: request, downloadProgress: null });
      }),
      api.onDownloadProgress((progress) => {
        console.log("[store] download-progress received:", progress.state, progress.fileName);
        set({ downloadProgress: progress });
        if (progress.state === "completed" || progress.state === "interrupted") {
          if (progress.state === "completed") {
            get().toast(i18n.t("toast.downloadCompleted"));
            void get().loadMetadata();
          }
          setTimeout(() => {
            set((s: any) =>
              s.downloadProgress?.downloadId === progress.downloadId
                ? { downloadProgress: null }
                : s
            );
          }, 4000);
        }
      }),
    ];
  },
});
