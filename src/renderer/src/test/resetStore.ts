import type { SearchCriteria, SearchDraft } from "@/lib/search";
import { useAppStore, type AppState } from "@/store/useAppStore";

/** 空的应用中条件；用例只覆盖自己关心的字段 */
export function blankCriteria(overrides: Partial<SearchCriteria> = {}): SearchCriteria {
  return {
    query: "",
    tags: [],
    artists: [],
    characters: [],
    genres: [],
    sort: "none",
    hideUnplayable: false,
    ...overrides,
  };
}

/** 空的草稿条件 */
export function blankDraft(overrides: Partial<SearchDraft> = {}): SearchDraft {
  return { query: "", tags: [], artists: [], characters: [], genres: [], ...overrides };
}

/**
 * 每例开始前的干净状态：用例会踩到的字段都在这里归零，避免上一例的残留影响断言。
 * 只覆盖自己关心的字段时用 `resetAppStore({ ... })`。
 */
const CLEAN: Partial<AppState> = {
  videos: [],
  metadataPath: "",
  metadataFileCount: 0,
  defaultMetadataPath: "",
  loading: false,
  loadError: null,
  loadErrorCode: null,
  initStarted: false,
  importPreview: null,
  importPaths: [],
  importsList: [],
  downloadRequest: null,
  downloadProgress: null,
  criteria: blankCriteria(),
  draft: blankDraft(),
  advancedOpen: false,
  page: 1,
  multiSelectMode: false,
  selectedIds: [],
  playlist: [],
  currentVideoId: null,
  toasts: [],
  editingVideo: null,
};

export function resetAppStore(overrides: Partial<AppState> = {}): void {
  useAppStore.setState({ ...CLEAN, ...overrides });
}
