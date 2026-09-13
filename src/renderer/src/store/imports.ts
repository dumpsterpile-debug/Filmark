import type { ImportPreviewResult, ImportedFileInfo } from "@shared/types";
import i18n from "@/i18n";
import { getApi } from "@/lib/api";
import type { SliceCreator } from "./slice";

/** 导入：选文件 → 预览 → 提交 → 管理已导入的文件列表 */
export interface ImportsSlice {
  importPreview: ImportPreviewResult | null;
  importPaths: string[];
  importsList: ImportedFileInfo[];

  startImport: () => Promise<void>;
  confirmImport: () => Promise<void>;
  cancelImport: () => void;
  refreshImports: () => Promise<void>;
  removeImport: (id: string) => Promise<void>;
  clearImports: () => Promise<void>;
}

export const createImportsSlice: SliceCreator<ImportsSlice> = (set, get) => ({
  importPreview: null,
  importPaths: [],
  importsList: [],

  startImport: async () => {
    const api = getApi();
    if (!api) return;
    const paths = await api.chooseImportSources(i18n.language);
    if (paths.length === 0) return;
    const existingIds = get().videos.map((v) => v.id);
    const preview = await api.previewImport(paths, existingIds);
    set({ importPaths: paths, importPreview: preview });
  },

  confirmImport: async () => {
    const { importPaths } = get();
    const api = getApi();
    if (!api || importPaths.length === 0) return;
    const existingIds = get().videos.map((v) => v.id);
    const result = await api.importMetadata(importPaths, existingIds);
    set({ importPaths: [], importPreview: null });
    if (result.ok) {
      get().toast(
        i18n.t("toast.imported", {
          count: result.imported ?? 0,
          skipped: result.skipped ?? 0,
        })
      );
      await get().loadMetadata();
    } else {
      get().toast(i18n.t("toast.importFailed", { error: result.error ?? "" }));
    }
    await get().refreshImports();
  },

  cancelImport: () => {
    set({ importPaths: [], importPreview: null });
  },

  refreshImports: async () => {
    const api = getApi();
    if (!api) return;
    const list = await api.listImports();
    set({ importsList: list });
  },

  removeImport: async (id) => {
    const api = getApi();
    if (!api) return;
    const result = await api.removeImport(id);
    if (result.ok) {
      await get().loadMetadata();
      await get().refreshImports();
      get().toast(i18n.t("toast.importRemoved"));
    } else {
      get().toast(i18n.t("toast.importFailed", { error: result.error ?? "" }));
    }
  },

  clearImports: async () => {
    const api = getApi();
    if (!api) return;
    const result = await api.clearImports();
    if (result.ok) {
      await get().loadMetadata();
      await get().refreshImports();
      get().toast(i18n.t("toast.importsCleared"));
    } else {
      get().toast(i18n.t("toast.importFailed", { error: result.error ?? "" }));
    }
  },
});
