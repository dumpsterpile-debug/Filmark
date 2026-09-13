import type { BootstrapSlice } from "./bootstrap";
import type { BrowserSlice } from "./browser";
import type { CriteriaSlice } from "./criteria";
import type { ImportsSlice } from "./imports";
import type { LibrarySlice } from "./library";
import type { PlaylistSlice } from "./playlist";
import type { SelectionSlice } from "./selection";
import type { SettingsSlice } from "./settings";
import type { ToastsSlice } from "./toasts";

/**
 * 完整 store = 各关注点切片相加。
 *
 * 新增一片 = 这里加一行、在组合根展开；切片之间不互相 import，
 * 需要别人时经 `SliceCreator` 拿到的 `get()` 访问（类型就是这里的 AppState）。
 */
export type AppState = LibrarySlice &
  ImportsSlice &
  BrowserSlice &
  CriteriaSlice &
  SelectionSlice &
  PlaylistSlice &
  ToastsSlice &
  SettingsSlice &
  BootstrapSlice;

export type ThumbSize = "small" | "medium" | "large";

export interface Toast {
  id: number;
  text: string;
}
