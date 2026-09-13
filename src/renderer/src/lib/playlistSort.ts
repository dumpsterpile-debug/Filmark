import type { Video } from "@shared/types";
import type { TranslationKey } from "@/i18n";

export type PlaylistSortMode =
  | "duration-asc"
  | "duration-desc"
  | "created-asc"
  | "created-desc"
  | "modified-asc"
  | "modified-desc";

/** 点击排序按钮时依次轮换的顺序 */
export const PLAYLIST_SORT_CYCLE: PlaylistSortMode[] = [
  "duration-asc",
  "duration-desc",
  "created-asc",
  "created-desc",
  "modified-asc",
  "modified-desc",
];

export const PLAYLIST_SORT_LABELS: Record<PlaylistSortMode, TranslationKey> = {
  "duration-asc": "psort.durationAsc",
  "duration-desc": "psort.durationDesc",
  "created-asc": "psort.createdAsc",
  "created-desc": "psort.createdDesc",
  "modified-asc": "psort.modifiedAsc",
  "modified-desc": "psort.modifiedDesc",
};

function parseTimestamp(value: string): number {
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

export function comparePlaylist(a: Video, b: Video, mode: PlaylistSortMode): number {
  switch (mode) {
    case "duration-asc":
      return a.durationMs - b.durationMs;
    case "duration-desc":
      return b.durationMs - a.durationMs;
    case "created-asc":
      return parseTimestamp(a.created) - parseTimestamp(b.created);
    case "created-desc":
      return parseTimestamp(b.created) - parseTimestamp(a.created);
    case "modified-asc":
      return parseTimestamp(a.modified) - parseTimestamp(b.modified);
    case "modified-desc":
      return parseTimestamp(b.modified) - parseTimestamp(a.modified);
  }
}
