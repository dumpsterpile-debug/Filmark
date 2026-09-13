import type { SliceCreator } from "./slice";
import type { Toast } from "./types";

/** 瞬时提示：自己排号、自己过期，任何切片都可以发 */
export interface ToastsSlice {
  toasts: Toast[];
  toast: (text: string) => void;
}

let toastId = 0;

export const createToastsSlice: SliceCreator<ToastsSlice> = (set) => ({
  toasts: [],

  toast: (text) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, text }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 2600);
  },
});
