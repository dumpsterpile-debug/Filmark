import type { Video } from "@shared/types";
import i18n from "@/i18n";
import { getApi } from "@/lib/api";
import type { SliceCreator } from "./slice";
import type { ThumbSize } from "./types";

/** 视频库：载入记录、记住来源、分页与缩略图尺寸、编辑一条记录 */
export interface LibrarySlice {
  videos: Video[];
  /** 实际生效的元数据来源；编辑与下载写入都按它定优先级（ADR-0002） */
  metadataPath: string;
  metadataFileCount: number;
  /** 持久化的默认来源，只作为写入优先级里的一档 */
  defaultMetadataPath: string;
  loading: boolean;
  loadError: string | null;
  loadErrorCode: string | null;
  page: number;
  pageSize: number;
  thumbSize: ThumbSize;
  editingVideo: Video | null;

  loadMetadata: (path?: string) => Promise<void>;
  chooseMetadata: () => Promise<void>;
  chooseDefaultSource: () => Promise<void>;
  resetDefaultSource: () => Promise<void>;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
  setThumbSize: (s: ThumbSize) => void;
  setEditingVideo: (video: Video | null) => void;
  clearEditingVideo: () => void;
  updateVideo: (id: string, fields: Record<string, unknown>) => Promise<void>;
}

export const createLibrarySlice: SliceCreator<LibrarySlice> = (set, get) => ({
  videos: [],
  metadataPath: "",
  metadataFileCount: 0,
  defaultMetadataPath: "",
  loading: true,
  loadError: null,
  loadErrorCode: null,
  page: 1,
  pageSize: 20,
  thumbSize: "medium",
  editingVideo: null,

  loadMetadata: async (path) => {
    const api = getApi();
    if (!api) {
      set({ loading: false, loadError: i18n.t("toast.noDesktopApi") });
      return;
    }
    set({ loading: true, loadError: null, loadErrorCode: null });
    const result = await api.loadMetadata(path, get().defaultMetadataPath, i18n.language);
    if (result.ok && result.videos) {
      const fileCount = result.fileCount ?? 1;
      set({
        videos: result.videos,
        metadataPath: result.source,
        metadataFileCount: fileCount,
        loading: false,
        page: 1,
      });
      const countText = result.count ?? result.videos.length;
      get().toast(
        fileCount > 1
          ? i18n.t("toast.loadedMulti", { count: countText, files: fileCount })
          : i18n.t("toast.loadedSingle", { count: countText })
      );
    } else {
      set({
        loading: false,
        loadError: result.error ?? i18n.t("toast.metadataLoadFailed"),
        loadErrorCode: result.errorCode ?? null,
      });
    }
  },

  chooseMetadata: async () => {
    const api = getApi();
    if (!api) return;
    const path = await api.chooseMetadataFile(i18n.language);
    if (path) await get().loadMetadata(path);
  },

  chooseDefaultSource: async () => {
    const api = getApi();
    if (!api) return;
    const path = await api.chooseMetadataSource(i18n.language);
    if (path) {
      await get().loadMetadata(path);
      if (!get().loadErrorCode) {
        set({ defaultMetadataPath: path });
        get().toast(i18n.t("toast.defaultSourceSet"));
      } else {
        get().toast(i18n.t("toast.defaultSourceFailed"));
      }
    }
  },

  resetDefaultSource: async () => {
    set({ defaultMetadataPath: "" });
    await get().loadMetadata();
    get().toast(i18n.t("toast.defaultSourceReset"));
  },

  setPage: (p) => set({ page: p }),
  setPageSize: (n) => set({ pageSize: n, page: 1 }),
  setThumbSize: (s) => set({ thumbSize: s }),

  setEditingVideo: (video) => set({ editingVideo: video }),
  clearEditingVideo: () => set({ editingVideo: null }),

  updateVideo: async (id, fields) => {
    const api = getApi();
    if (!api) return;
    // 传入当前实际加载来源与持久化来源，确保写入真实数据文件而非固定默认目录
    const result = await api.updateVideo(id, fields, get().metadataPath, get().defaultMetadataPath);
    if (result.ok) {
      get().toast(i18n.t("edit.saveSuccess"));
      get().clearEditingVideo();
      await get().loadMetadata();
    } else {
      get().toast(i18n.t("edit.saveFailed", { error: result.error ?? "unknown" }));
    }
  },
});
