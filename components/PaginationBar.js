"use client";

/**
 * List footer: range summary, page-size dropdown, ellipsis page numbers, and optional `leftExtra` slot (e.g. filters).
 */
export default function PaginationBar({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  leftExtra = null
}) {
  // `leftExtra` is optional JSX rendered next to the "Showing X–Y of Z" summary.
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeLimit = Math.max(1, Number(limit) || 20);
  const safePage = Math.max(1, Math.min(Number(page) || 1, Math.max(1, totalPages)));
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);

  const start = safeTotal === 0 ? 0 : (safePage - 1) * safeLimit + 1;
  const end = Math.min(safePage * safeLimit, safeTotal);

  /** @returns {(number|null)[]} numbers or null for ellipsis gap */
  function visiblePageList() {
    const t = safeTotalPages;
    const c = safePage;
    if (t <= 7) {
      return Array.from({ length: t }, (_, i) => i + 1);
    }
    const set = new Set([1, t, c, c - 1, c + 1, c - 2, c + 2].filter((p) => p >= 1 && p <= t));
    const sorted = [...set].sort((a, b) => a - b);
    const out = [];
    let prev = 0;
    for (const p of sorted) {
      if (p - prev > 1) out.push(null);
      out.push(p);
      prev = p;
    }
    return out;
  }

  const pages = visiblePageList();

  return (
    <div className="pagination-footer">
      <div className="pagination-footer-left">
        <span className="pagination-summary">
          Showing <strong>{start}</strong>–<strong>{end}</strong> of <strong>{safeTotal}</strong>{" "}
          results
        </span>
        {leftExtra ? <span style={{ marginLeft: 10 }}>{leftExtra}</span> : null}
      </div>
      <div className="pagination-footer-right">
        <label className="pagination-rows-label">
          Rows
          <select
            className="pagination-rows-select"
            value={String(limit)}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            aria-label="Rows per page"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
        <button
          type="button"
          className="pagination-nav-btn"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          Previous
        </button>
        <div className="pagination-pages" role="navigation" aria-label="Pages">
          {pages.map((p, i) =>
            p == null ? (
              <span key={`e-${i}`} className="pagination-ellipsis">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={`pagination-page-btn${p === safePage ? " is-active" : ""}`}
                onClick={() => onPageChange(p)}
                aria-current={p === safePage ? "page" : undefined}
              >
                {p}
              </button>
            )
          )}
        </div>
        <button
          type="button"
          className="pagination-nav-btn"
          disabled={safePage >= safeTotalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
