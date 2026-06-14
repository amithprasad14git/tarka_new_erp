"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

export default function TaskExpandableSearch({ open, value, onChange, placeholder = "Search tasks…" }) {
  const inputId = useId();
  const inputRef = useRef(null);
  const prevOpenRef = useRef(false);
  const blurTimerRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const hasQuery = Boolean(String(value || "").trim());
  const isExpanded = searchOpen || hasQuery;

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setSearchOpen(false);
    }
    prevOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  function handleIconClick() {
    if (!isExpanded) {
      openSearch();
      return;
    }
    inputRef.current?.focus();
  }

  function handleBlur() {
    if (hasQuery) return;
    blurTimerRef.current = setTimeout(() => {
      setSearchOpen(false);
    }, 150);
  }

  function handleFocus() {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Escape" && !hasQuery) {
      event.preventDefault();
      setSearchOpen(false);
      inputRef.current?.blur();
    }
  }

  function handleClear() {
    onChange?.("");
    setSearchOpen(false);
  }

  return (
    <div className={`task-list-command-search${isExpanded ? " is-open" : ""}`}>
      <button
        type="button"
        className={`task-list-command-search-trigger${isExpanded ? " is-active" : ""}`}
        onClick={handleIconClick}
        aria-label="Search tasks"
        aria-expanded={isExpanded}
        aria-controls={inputId}
      >
        <span aria-hidden="true">⌕</span>
      </button>
      <div className="task-list-command-search-field">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="searchbox"
          autoComplete="off"
          className="task-list-command-search-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          aria-label="Search tasks"
          tabIndex={isExpanded ? 0 : -1}
        />
        {hasQuery ? (
          <button
            type="button"
            className="task-list-command-search-clear"
            onClick={handleClear}
            aria-label="Clear search"
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
