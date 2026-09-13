import type { FacetKind, SearchCriteria, SearchDraft, SortMode } from "@/lib/search";
import type { SliceCreator } from "./slice";

/** 搜索条件：草稿（编辑中）与应用中的条件都在这一片，可见列表只读 `criteria` */
export interface CriteriaSlice {
  /** 应用中的条件：可见列表的唯一输入（含排序与隐藏不可播放） */
  criteria: SearchCriteria;
  /** 编辑中的条件：改动它不影响列表，applySearch 才写回 criteria */
  draft: SearchDraft;
  advancedOpen: boolean;

  setDraftQuery: (q: string) => void;
  toggleDraft: (kind: FacetKind, value: string) => void;
  clearDrafts: () => void;
  setAdvancedOpen: (open: boolean) => void;
  applySearch: () => void;
  removeApplied: (kind: FacetKind, value: string) => void;
  setSortMode: (m: SortMode) => void;
  setHideUnplayable: (v: boolean) => void;
}

const EMPTY_DRAFT: SearchDraft = {
  query: "",
  tags: [],
  artists: [],
  characters: [],
  genres: [],
};

const INITIAL_CRITERIA: SearchCriteria = { ...EMPTY_DRAFT, sort: "none", hideUnplayable: false };

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export const createCriteriaSlice: SliceCreator<CriteriaSlice> = (set) => ({
  criteria: INITIAL_CRITERIA,
  draft: EMPTY_DRAFT,
  advancedOpen: false,

  setDraftQuery: (q) => set((s) => ({ draft: { ...s.draft, query: q } })),
  toggleDraft: (kind, value) =>
    set((s) => ({ draft: { ...s.draft, [kind]: toggleValue(s.draft[kind], value) } })),
  clearDrafts: () => set({ draft: EMPTY_DRAFT }),
  setAdvancedOpen: (open) => set({ advancedOpen: open }),

  /** 草稿 → 生效：可见列表的唯一切换点，顺带回到第一页 */
  applySearch: () =>
    set((s) => ({ criteria: { ...s.criteria, ...s.draft }, page: 1, advancedOpen: false })),

  removeApplied: (kind, value) =>
    set((s) => ({
      criteria: { ...s.criteria, [kind]: s.criteria[kind].filter((v) => v !== value) },
      page: 1,
    })),

  // 排序与隐藏开关立即生效，不经过草稿
  setSortMode: (m) => set((s) => ({ criteria: { ...s.criteria, sort: m }, page: 1 })),
  setHideUnplayable: (v) => set((s) => ({ criteria: { ...s.criteria, hideUnplayable: v } })),
});
