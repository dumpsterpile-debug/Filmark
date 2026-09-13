import { getApi } from "@/lib/api";
import type { SliceCreator } from "./slice";

/** 启动：跑一次初始加载，之后由门挡住重复执行 */
export interface BootstrapSlice {
  /** 初始加载是否已经跑过；测试重置它即可让 init 重跑（不入持久化） */
  initStarted: boolean;
  init: () => Promise<void>;
}

export const createBootstrapSlice: SliceCreator<BootstrapSlice> = (set, get) => ({
  initStarted: false,

  init: async () => {
    if (get().initStarted) return;
    set({ initStarted: true });
    const api = getApi();
    if (api) {
      const pl = await api.loadPlaylist();
      if (pl.ok && pl.items.length > 0) {
        set({ playlist: pl.items });
      }
    }
    get().attachDownloadListeners();
    await get().loadMetadata();
    await get().refreshImports();
  },
});
