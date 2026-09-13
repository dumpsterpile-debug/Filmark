/** 合并 facet 候选与用户新建 Chip：去重，facet 顺序在前，用户新建追加在后 */
export function mergeChipCandidates(facetNames: string[], userChips: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...facetNames, ...userChips]) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/** 按子串（忽略大小写）过滤候选 */
export function filterCandidates(candidates: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return candidates;
  return candidates.filter((c) => c.toLowerCase().includes(q));
}
