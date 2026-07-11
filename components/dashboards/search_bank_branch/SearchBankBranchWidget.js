"use client";

// Dashboard widget UI — Search Bank & Branch (typeahead branch lookup).

/**
 * Landing widget: user types branch code or name; results from
 * GET /api/dashboard/search-bank-branch/search?q=...
 * Guide: README.md#5a-landing-dashboards
 */

import { useCallback, useEffect, useRef, useState } from "react";
import DashboardSectionHeader from "../shared/DashboardSectionHeader";
import DashboardWidgetRefreshHeader from "../shared/DashboardWidgetRefreshHeader";
import { formatApiErrorPayload, readJsonResponse } from "../../../lib/fetchClientError";

const SEARCH_DEBOUNCE_MS = 350;
const MIN_TERM_LENGTH = 2;

/**
 * @param {object} props
 */
export default function SearchBankBranchWidget() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const lastQueryRef = useRef("");
  const debounceRef = useRef(null);

  const runSearch = useCallback(async (term) => {
    const q = String(term ?? "").trim();
    lastQueryRef.current = q;

    // Clear results until user types at least MIN_TERM_LENGTH characters.
    if (q.length < MIN_TERM_LENGTH) {
      setRows([]);
      setTruncated(false);
      setSearchError("");
      setHasSearched(false);
      return;
    }

    setSearching(true);
    setSearchError("");
    setHasSearched(true);

    try {
      const res = await fetch(
        `/api/dashboard/search-bank-branch/search?q=${encodeURIComponent(q)}`,
        { cache: "no-store" }
      );
      const body = await readJsonResponse(res);
      if (!res.ok) {
        setSearchError(formatApiErrorPayload(body, "Search failed"));
        setRows([]);
        setTruncated(false);
        return;
      }
      setRows(body?.rows || []);
      setTruncated(Boolean(body?.truncated));
    } catch {
      setSearchError("Search failed");
      setRows([]);
      setTruncated(false);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    // Debounce keystrokes so we do not hit the API on every character.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  function handleSubmit(e) {
    e.preventDefault();
    // Search button bypasses debounce — run immediately.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(query);
  }

  const showNoResults = hasSearched && !searching && !searchError && rows.length === 0;

  return (
    <article className="dashboard-widget-card dashboard-widget-card--bank-branch-search">
      <DashboardWidgetRefreshHeader title="Search Bank & Branch" showRefresh={false} />

      <div className="dashboard-bank-branch-panel">
        <form className="dashboard-bank-branch-search" onSubmit={handleSubmit}>
          <input
            type="search"
            className="dashboard-bank-branch-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter Branch code or name to search"
            aria-label="Branch code or name"
            autoComplete="off"
          />
          <button
            type="submit"
            className="master-btn master-btn-outline"
            disabled={searching || query.trim().length < MIN_TERM_LENGTH}
          >
            Search
          </button>
        </form>

        {searchError ? <p className="dashboard-widget-error">{searchError}</p> : null}

        <DashboardSectionHeader title="Results" subtitle={hasSearched ? `${rows.length} match(es)` : "—"} />

        <div className="dashboard-bank-branch-body" aria-busy={searching}>
          {searching ? (
            <p className="dashboard-widget-empty dashboard-widget-empty--inline">Searching…</p>
          ) : null}

          {showNoResults ? (
            <p className="dashboard-widget-empty dashboard-widget-empty--inline">No branches found.</p>
          ) : null}

          {rows.length > 0 && !searching ? (
            <div className="dashboard-bank-branch-results">
              {truncated ? (
                <p className="dashboard-bank-branch-truncated">Showing first 50 results.</p>
              ) : null}
              <div className="dashboard-sample-table-wrap">
                <table className="dashboard-sample-table">
                  <thead>
                    <tr>
                      <th>Bank</th>
                      <th>HO/ZO</th>
                      <th>RBO/RO</th>
                      <th>Code</th>
                      <th>Branch</th>
                      <th>Place</th>
                      <th>Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const key = `${row.branchCode}-${row.bankLabel}-${row.rboRoLabel}`;
                      return (
                        <tr key={key}>
                          <td>{row.bankLabel}</td>
                          <td>{row.hoZoLabel}</td>
                          <td>{row.rboRoLabel}</td>
                          <td>{row.branchCode}</td>
                          <td>{row.branchName}</td>
                          <td>{row.place}</td>
                          <td>{row.active}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

