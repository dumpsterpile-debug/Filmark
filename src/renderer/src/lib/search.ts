import Fuse from "fuse.js";
import type { Video } from "@shared/types";
import type { TranslationKey } from "@/i18n";

export type SortMode = "none" | "date-desc" | "date-asc" | "title-asc" | "title-desc";

export interface SearchFilters {
  tags: string[];
  artists: string[];
  characters: string[];
  genres: string[];
}

/** facet 的四个大类；toggle/remove 这类动作用它做参数，避免四套同形签名 */
export type FacetKind = keyof SearchFilters;

/**
 * 编辑中的搜索条件（草稿）。
 * 排序与隐藏开关不在草稿里 —— 它们是立即生效的显示选项。
 */
export type SearchDraft = SearchFilters & { query: string };
/**
 * 构成可见列表的全部输入。
 *
 * 这是「哪些视频可见」的唯一输入形状，唯一构造点是 store 的 `criteriaFrom()`。
 * 页面与 action 都不得自行拼装这组字段 —— 历史上三处各拼一份，其中两处漏掉了
 * `hideUnplayable`，同一个查询在不同入口会给出不同列表。
 */
export interface SearchCriteria extends SearchFilters {
  query: string;
  sort: SortMode;
  hideUnplayable: boolean;
}
export interface Facet {
  name: string;
  count: number;
}

export function buildFacets(videos: Video[]): {
  tags: Facet[];
  artists: Facet[];
  characters: Facet[];
  genres: Facet[];
} {
  const collect = (pick: (v: Video) => string[]): Facet[] => {
    const map = new Map<string, number>();
    for (const v of videos) {
      for (const name of pick(v)) {
        if (!name) continue;
        map.set(name, (map.get(name) ?? 0) + 1);
      }
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  };
  return {
    tags: collect((v) => v.tags),
    artists: collect((v) => v.artist),
    characters: collect((v) => v.character),
    genres: collect((v) => (v.genre ? [v.genre] : [])),
  };
}

function timestamp(value: string): number {
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * 可见列表的唯一实现：查询 → facet 筛选 → 排序 → 隐藏不可播放。
 *
 * 组件经 `useCriteria()` 取条件，store action 经 `criteriaFrom(get())` 取条件，
 * 任何地方都不要自行拼装条件或只做其中一半。
 */
export function selectVisible(videos: Video[], criteria: SearchCriteria): Video[] {
  let result = videos;
  const q = criteria.query.trim();

  if (q) {
    const fuse = new Fuse(videos, {
      keys: [
        { name: "title", weight: 0.5 },
        { name: "tags", weight: 0.25 },
        { name: "artist", weight: 0.15 },
        { name: "character", weight: 0.05 },
        { name: "genre", weight: 0.05 },
      ],
      threshold: 0.42,
      ignoreLocation: true,
      ignoreFieldNorm: true,
      shouldSort: true,
    });
    result = fuse.search(q).map((r) => r.item);
  }

  if (criteria.tags.length > 0) {
    result = result.filter((v) => criteria.tags.every((t) => v.tags.includes(t)));
  }
  if (criteria.artists.length > 0) {
    result = result.filter((v) => criteria.artists.every((a) => v.artist.includes(a)));
  }
  if (criteria.characters.length > 0) {
    result = result.filter((v) => criteria.characters.every((c) => v.character.includes(c)));
  }
  if (criteria.genres.length > 0) {
    result = result.filter((v) => criteria.genres.includes(v.genre));
  }

  switch (criteria.sort) {
    case "date-desc":
      result = [...result].sort((a, b) => timestamp(b.created) - timestamp(a.created));
      break;
    case "date-asc":
      result = [...result].sort((a, b) => timestamp(a.created) - timestamp(b.created));
      break;
    case "title-asc":
      result = [...result].sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
      break;
    case "title-desc":
      result = [...result].sort((a, b) => b.title.localeCompare(a.title, "zh-CN"));
      break;
    case "none":
    default:
      break;
  }

  // 过滤放在排序之后：结果集合相同，但保持排序稳定
  return criteria.hideUnplayable ? result.filter((v) => v.playable !== false) : result;
}

export const SORT_LABELS: Record<SortMode, TranslationKey> = {
  none: "sort.none",
  "date-desc": "sort.dateDesc",
  "date-asc": "sort.dateAsc",
  "title-asc": "sort.titleAsc",
  "title-desc": "sort.titleDesc",
};
