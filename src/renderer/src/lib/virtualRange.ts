/** 窗口化列表可见区间：固定行高 + 视口 + overscan */
export function computeVisibleRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  total: number,
  overscan: number
): { start: number; end: number } {
  if (total <= 0) return { start: 0, end: 0 };
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(total, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  return { start, end };
}
