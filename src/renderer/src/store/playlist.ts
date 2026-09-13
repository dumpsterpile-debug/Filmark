import type { StoreApi } from "zustand";
import type { Video } from "@shared/types";
import i18n from "@/i18n";
import { getApi } from "@/lib/api";
import { selectVisible } from "@/lib/search";
import type { SliceCreator } from "./slice";
import type { AppState } from "./types";

/** 播放单与播放状态：列表本身不持久化（落盘走文件），播放偏好持久化 */
export interface PlaylistSlice {
  playlist: Video[];
  currentVideoId: string | null;
  autoplay: boolean;
  theaterMode: boolean;
  volume: number;
  muted: boolean;

  /** 返回本次真正新增的条数（重复项与不可播放项不计） */
  addToPlaylist: (items: Video[], opts?: { silent?: boolean }) => number;
  selectAllAndPlay: () => boolean;
  removeFromPlaylist: (id: string) => void;
  reorderPlaylist: (from: number, to: number) => void;
  clearPlaylist: () => void;
  setPlaylist: (items: Video[]) => void;
  playVideo: (video: Video) => void;
  setCurrentVideoId: (id: string | null) => void;
  setAutoplay: (v: boolean) => void;
  setTheaterMode: (v: boolean) => void;
  setVolume: (v: number) => void;
  setMuted: (v: boolean) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function dedupe(items: Video[], incoming: Video[]): Video[] {
  const seen = new Set(items.map((v) => v.id));
  const merged = [...items];
  for (const v of incoming) {
    if (!seen.has(v.id)) {
      seen.add(v.id);
      merged.push(v);
    }
  }
  return merged;
}

function schedulePlaylistSave(items: Video[]): void {
  const api = getApi();
  if (!api) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void api.savePlaylist(items);
  }, 600);
}

/**
 * 播放单落盘的唯一接线点：播放单身份变化 → 600ms 防抖 → 写文件。
 * 放在切片里而不是组合根，是为了让「播放单怎么存」只有这一个模块知道。
 */
export function wirePlaylistPersistence(store: StoreApi<AppState>): void {
  store.subscribe((state, prev) => {
    if (state.playlist !== prev.playlist) {
      schedulePlaylistSave(state.playlist);
    }
  });
}

export const createPlaylistSlice: SliceCreator<PlaylistSlice> = (set, get) => ({
  playlist: [],
  currentVideoId: null,
  autoplay: true,
  theaterMode: false,
  volume: 0.8,
  muted: false,

  addToPlaylist: (items, opts) => {
    const playable = items.filter((v) => v.playable !== false);
    const before = get().playlist.length;
    set((s) => ({ playlist: dedupe(s.playlist, playable) }));
    const added = get().playlist.length - before;
    if (!opts?.silent) get().toast(i18n.t("toast.addedToPlaylist", { count: added }));
    return added;
  },

  selectAllAndPlay: () => {
    const s = get();
    // 可见列表已包含 hideUnplayable；这里再排一次不可播放项：
    // 「全部加入播放单」只收可播放条目，与工具栏开关无关
    const playableFiltered = selectVisible(s.videos, s.criteria).filter(
      (v) => v.playable !== false
    );
    if (playableFiltered.length === 0) {
      get().toast(i18n.t("toast.nothingToAdd"));
      return false;
    }
    const first = playableFiltered[0];
    if (!first) {
      get().toast(i18n.t("toast.nothingToAdd"));
      return false;
    }
    set({ playlist: playableFiltered, currentVideoId: first.id });
    get().toast(i18n.t("toast.playlistCreated", { count: playableFiltered.length }));
    return true;
  },

  removeFromPlaylist: (id) => set((s) => ({ playlist: s.playlist.filter((v) => v.id !== id) })),

  reorderPlaylist: (from, to) =>
    set((s) => {
      const list = [...s.playlist];
      if (from < 0 || from >= list.length || to < 0 || to >= list.length) return s;
      const [moved] = list.splice(from, 1);
      if (!moved) return s;
      list.splice(to, 0, moved);
      return { playlist: list };
    }),

  clearPlaylist: () => set({ playlist: [] }),
  setPlaylist: (items) => set({ playlist: items }),

  playVideo: (video) =>
    set((s) => {
      const index = s.playlist.findIndex((v) => v.id === video.id);
      const playlist = index >= 0 ? s.playlist : [video, ...s.playlist];
      return { playlist, currentVideoId: video.id };
    }),

  setCurrentVideoId: (id) => set({ currentVideoId: id }),
  setAutoplay: (v) => set({ autoplay: v }),
  setTheaterMode: (v) => set({ theaterMode: v }),
  setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)), muted: false }),
  setMuted: (v) => set({ muted: v }),
});
