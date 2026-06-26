"use client";

// Report UI — scrollable table region with scroll-down / scroll-to-top hints (scrollbar hidden).

import { useCallback, useEffect, useRef, useState } from "react";

const SCROLL_DOWN_SRC = "/images/report-scroll-hint.svg";
const SCROLL_TOP_SRC = "/images/report-scroll-top-hint.svg";

/**
 * @param {{ children: import("react").ReactNode, ariaLabel?: string }} props
 */
export default function ReportTableScrollRegion({ children, ariaLabel = "Report data" }) {
  const scrollRef = useRef(null);
  const [overflowY, setOverflowY] = useState(false);
  const [atBottom, setAtBottom] = useState(true);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 2;
    setOverflowY(hasOverflow);
    setAtBottom(!hasOverflow || el.scrollHeight - el.scrollTop - el.clientHeight < 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return undefined;

    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    el.addEventListener("scroll", updateScrollState, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", updateScrollState);
    };
  }, [updateScrollState, children]);

  function scrollToTop() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
  }

  const showScrollDown = overflowY && !atBottom;
  const showScrollTop = overflowY && atBottom;

  return (
    <div
      className={`report-output-table-scroll-outer${overflowY ? " has-overflow" : ""}${showScrollDown ? " has-scroll-hint" : ""}${showScrollTop ? " has-scroll-top" : ""}`}
    >
      <div
        ref={scrollRef}
        className="report-output-table-scroll"
        tabIndex={0}
        role="region"
        aria-label={ariaLabel}
      >
        {children}
      </div>
      {overflowY ? (
        <div className="report-output-scroll-footer-slot">
          {showScrollDown ? (
            <div className="report-output-scroll-hint" aria-hidden="true">
              <img src={SCROLL_DOWN_SRC} alt="" className="report-output-scroll-hint-img" width={28} height={35} />
            </div>
          ) : null}
          {showScrollTop ? (
            <button
              type="button"
              className="report-output-scroll-top"
              aria-label="Scroll to top of report"
              title="Scroll to top"
              onClick={scrollToTop}
            >
              <img
                src={SCROLL_TOP_SRC}
                alt=""
                className="report-output-scroll-hint-img report-output-scroll-top-img"
                width={28}
                height={35}
              />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
