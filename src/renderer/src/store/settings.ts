import {
  assignShortcut,
  defaultShortcuts,
  removeShortcut,
  DEFAULT_SHORTCUTS,
  type AssignShortcutResult,
  type ShortcutAction,
  type ShortcutMap,
} from "@shared/shortcuts";
import type { SliceCreator } from "./slice";

/** 偏好设置：快捷键、每个作者的上次选择、自定义筛选项、播放续播 */
export interface SettingsSlice {
  shortcutsEnabled: boolean;
  shortcuts: ShortcutMap;
  perArtistPrefs: Record<string, { genre?: string; character?: string }>;
  userChips: Record<"tags" | "artist" | "character" | "genre", string[]>;
  resumePlayback: boolean;

  setShortcutsEnabled: (v: boolean) => void;
  assignShortcutBinding: (
    action: ShortcutAction,
    binding: string,
    index?: number | null
  ) => AssignShortcutResult;
  removeShortcutBinding: (action: ShortcutAction, index: number) => void;
  resetShortcut: (action: ShortcutAction) => void;
  resetAllShortcuts: () => void;
  savePerArtistPrefs: (artist: string, prefs: { genre?: string; character?: string }) => void;
  addUserChip: (kind: "tags" | "artist" | "character" | "genre", value: string) => void;
  setResumePlayback: (v: boolean) => void;
}

export const createSettingsSlice: SliceCreator<SettingsSlice> = (set, get) => ({
  shortcutsEnabled: true,
  shortcuts: defaultShortcuts(),
  perArtistPrefs: {},
  userChips: { tags: [], artist: [], character: [], genre: [] },
  resumePlayback: true,

  setShortcutsEnabled: (v) => set({ shortcutsEnabled: v }),

  assignShortcutBinding: (action, binding, index = null) => {
    const result = assignShortcut(get().shortcuts, action, binding, index);
    if (result.ok) set({ shortcuts: result.shortcuts });
    return result;
  },

  removeShortcutBinding: (action, index) =>
    set((s) => ({ shortcuts: removeShortcut(s.shortcuts, action, index) })),

  resetShortcut: (action) =>
    set((s) => ({ shortcuts: { ...s.shortcuts, [action]: [...DEFAULT_SHORTCUTS[action]] } })),

  resetAllShortcuts: () => set({ shortcuts: defaultShortcuts() }),

  savePerArtistPrefs: (artist, prefs) => {
    if (!artist) return;
    set((s) => ({
      perArtistPrefs: {
        ...s.perArtistPrefs,
        [artist]: { ...s.perArtistPrefs[artist], ...prefs },
      },
    }));
  },

  addUserChip: (kind, value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    set((s) => ({
      userChips: {
        ...s.userChips,
        [kind]: s.userChips[kind].includes(trimmed)
          ? s.userChips[kind]
          : [...s.userChips[kind], trimmed],
      },
    }));
  },

  setResumePlayback: (v) => set({ resumePlayback: v }),
});
