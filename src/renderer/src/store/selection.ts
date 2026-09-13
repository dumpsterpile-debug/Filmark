import i18n from "@/i18n";
import type { SliceCreator } from "./slice";

/** 多选：只在「加入播放单」上有意义，选中集合与模式开关同时归零 */
export interface SelectionSlice {
  multiSelectMode: boolean;
  selectedIds: string[];

  toggleMultiSelect: () => void;
  toggleSelected: (id: string) => void;
  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;
  addSelectedToPlaylist: () => void;
}

export const createSelectionSlice: SliceCreator<SelectionSlice> = (set, get) => ({
  multiSelectMode: false,
  selectedIds: [],

  toggleMultiSelect: () => set((s) => ({ multiSelectMode: !s.multiSelectMode, selectedIds: [] })),
  toggleSelected: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [] }),

  addSelectedToPlaylist: () => {
    const { videos, selectedIds } = get();
    const items = videos.filter((v) => selectedIds.includes(v.id) && v.playable !== false);
    if (items.length === 0) {
      get().toast(i18n.t("toast.noSelection"));
      return;
    }
    // 只发一条提示：addToPlaylist 的通用提示对「批量加入所选」是重复的
    const added = get().addToPlaylist(items, { silent: true });
    get().toast(i18n.t("toast.addedSelected", { count: added }));
    set({ selectedIds: [], multiSelectMode: false });
  },
});
