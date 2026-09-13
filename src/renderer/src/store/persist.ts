import type { SearchCriteria } from "@/lib/search";
import type { AppState } from "./types";

/**
 * 跨启动保留的顶层键：只有真正该留下的设置在这里露面。
 *
 * 新增持久字段 = 往表里加一行；`partialize` 由它生成，
 * 不再维护第二个手写对象（历史上两处必须同时改，漏一处就静默丢配置）。
 */
export const DURABLE_KEYS = [
  "pageSize",
  "thumbSize",
  "autoplay",
  "volume",
  "muted",
  "defaultMetadataPath",
  "defaultWebUrl",
  "downloadPath",
  "siteExtractEnabled",
  "perArtistPrefs",
  "userChips",
  "resumePlayback",
  "shortcutsEnabled",
  "shortcuts",
] as const satisfies readonly (keyof AppState)[];

/**
 * 落在 `criteria` 里、但同样要跨启动保留的两个显示选项。
 * 查询与 facet 是当次会话的选择，不进存储。
 */
export const DURABLE_CRITERIA_KEYS = [
  "sort",
  "hideUnplayable",
] as const satisfies readonly (keyof SearchCriteria)[];

/** 写进存储的形状：顶层 durable 键 + 两个 criteria 选项（沿用扁平键名） */
export type PersistedSettings = Pick<AppState, (typeof DURABLE_KEYS)[number]> &
  Pick<SearchCriteria, (typeof DURABLE_CRITERIA_KEYS)[number]>;

export function pickDurable(state: AppState): PersistedSettings {
  const picked: Record<string, unknown> = {};
  for (const key of DURABLE_KEYS) picked[key] = state[key];
  for (const key of DURABLE_CRITERIA_KEYS) picked[key] = state.criteria[key];
  return picked as PersistedSettings;
}
