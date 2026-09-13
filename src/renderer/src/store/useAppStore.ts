import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Video } from "@shared/types";
import { selectVisible, type SearchCriteria, type SearchDraft, type SortMode } from "@/lib/search";
import { sanitizeShortcuts } from "@shared/shortcuts";
import { createBootstrapSlice } from "./bootstrap";
import { createBrowserSlice } from "./browser";
import { createCriteriaSlice } from "./criteria";
import { createImportsSlice } from "./imports";
import { createLibrarySlice } from "./library";
import { pickDurable, type PersistedSettings } from "./persist";
import { createPlaylistSlice, wirePlaylistPersistence } from "./playlist";
import { createSelectionSlice } from "./selection";
import { createSettingsSlice } from "./settings";
import type { SliceCreator } from "./slice";
import { createToastsSlice } from "./toasts";
import type { AppState } from "./types";

export type { AppState, ThumbSize } from "./types";

/**
 * 组合根：这里只做三件事 —— 把切片拼起来、声明持久化、导出「可见列表」的对外选择器。
 *
 * 具体规则都在各自的切片文件里（`store/*.ts`），本文件不再出现任何字段或业务分支；
 * 切片之间通过 `get()` 互相调用，因此新增关注点不会让这里变大。
 */
const initializer: SliceCreator<AppState> = (set, get, api) => ({
  ...createLibrarySlice(set, get, api),
  ...createImportsSlice(set, get, api),
  ...createBrowserSlice(set, get, api),
  ...createCriteriaSlice(set, get, api),
  ...createSelectionSlice(set, get, api),
  ...createPlaylistSlice(set, get, api),
  ...createToastsSlice(set, get, api),
  ...createSettingsSlice(set, get, api),
  ...createBootstrapSlice(set, get, api),
});

export const useAppStore = create<AppState>()(
  persist(initializer, {
    name: "media-player-settings",
    partialize: pickDurable,
    merge: (persisted, current) => {
      const { sort, hideUnplayable, sortMode, ...rest } = (persisted ?? {}) as Partial<
        PersistedSettings & { sortMode?: SortMode }
      >;
      return {
        ...current,
        ...rest,
        criteria: {
          ...current.criteria,
          // 排序与隐藏开关存成扁平键；sortMode 是旧版本的键名，读到就迁移
          sort: sort ?? sortMode ?? current.criteria.sort,
          hideUnplayable: hideUnplayable ?? current.criteria.hideUnplayable,
        },
        userChips: { ...current.userChips, ...rest.userChips },
        perArtistPrefs: { ...current.perArtistPrefs, ...rest.perArtistPrefs },
        // 清洗后保证：新增动作有默认绑定、非法/重复项被丢弃
        shortcuts: sanitizeShortcuts(rest.shortcuts),
      };
    },
  })
);

// 播放单落盘的接线；实现（防抖 + 写文件）在 playlist 切片里
wirePlaylistPersistence(useAppStore);

/** 应用中的搜索条件：整个条件是一个值，因此不需要浅比较 */
export function useCriteria(): SearchCriteria {
  return useAppStore((s) => s.criteria);
}

/** 编辑中的搜索条件；只有 applySearch 会把它写回 criteria */
export function useDraft(): SearchDraft {
  return useAppStore((s) => s.draft);
}

/** 当前可见列表（唯一来源）。非 React 上下文使用。 */
export function selectVisibleVideos(): Video[] {
  const s = useAppStore.getState();
  return selectVisible(s.videos, s.criteria);
}
