import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, total, current - 1, current, current + 1]);
  const list: (number | "…")[] = [];
  let prev = 0;
  for (const n of [...set].sort((a, b) => a - b)) {
    if (n < 1 || n > total) continue;
    if (prev > 0 && n - prev > 1) list.push("…");
    list.push(n);
    prev = n;
  }
  return list;
}

export default function Pagination({
  total,
  page,
  pageSize,
  onPage,
  onPageSize,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="pagination">
      <div className="page-size">
        <span className="page-size-label">{t("pagination.perPage")}</span>
        <div className="segmented">
          {[20, 50, 100].map((n) => (
            <button
              key={n}
              className={pageSize === n ? "segment active" : "segment"}
              onClick={() => onPageSize(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <span className="page-range">{t("pagination.range", { start, end, total })}</span>

      <div className="page-buttons">
        <button
          className="page-btn"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          title={t("pagination.prev")}
        >
          <ChevronLeft size={16} />
        </button>
        {pageNumbers(page, totalPages).map((n, i) =>
          n === "…" ? (
            <span key={`e-${i}`} className="page-ellipsis">
              …
            </span>
          ) : (
            <button
              key={n}
              className={n === page ? "page-btn active" : "page-btn"}
              onClick={() => onPage(n)}
            >
              {n}
            </button>
          )
        )}
        <button
          className="page-btn"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          title={t("pagination.next")}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
