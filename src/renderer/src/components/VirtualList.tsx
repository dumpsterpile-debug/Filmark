import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { computeVisibleRange } from "@/lib/virtualRange";

/** 与 .edit-row 实际渲染高度保持一致（缩略图 132px 宽 × 16:9 + 内边距 + 边框） */
export const ROW_HEIGHT = 92;
const OVERSCAN = 4;
/** 视口最多同时展示的行数，超出后在列表内部滚动 */
const MAX_VISIBLE_ROWS = 12;

export default function VirtualList({
  total,
  rowHeight = ROW_HEIGHT,
  overscan = OVERSCAN,
  maxRows = MAX_VISIBLE_ROWS,
  renderRow,
}: {
  total: number;
  rowHeight?: number;
  overscan?: number;
  maxRows?: number;
  renderRow: (index: number) => ReactNode;
}): JSX.Element {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(360);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    setViewportHeight(el.clientHeight);
    const observer = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const visible = useMemo(
    () => computeVisibleRange(scrollTop, viewportHeight, rowHeight, total, overscan),
    [scrollTop, viewportHeight, rowHeight, total, overscan]
  );

  const rows: ReactNode[] = [];
  for (let i = visible.start; i < visible.end; i += 1) {
    rows.push(renderRow(i));
  }

  return (
    <div
      className="virtual-viewport"
      ref={viewportRef}
      style={{ maxHeight: maxRows * rowHeight }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div className="virtual-spacer" style={{ height: total * rowHeight }}>
        {rows}
      </div>
    </div>
  );
}
