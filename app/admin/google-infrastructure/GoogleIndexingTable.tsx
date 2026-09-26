"use client";

import { useMemo, useState } from "react";
import type { GoogleIndexingRow } from "@/actions/google-infrastructure";

const TABLE_HEAD_STYLE: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid var(--admin-border, #2A3244)", color: "var(--admin-text-faint, #6B7385)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" as const };
const TABLE_CELL_STYLE: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid var(--admin-border, #2A3244)", fontSize: 12.5, verticalAlign: "top" };

type SortKey = "pageType" | "title" | "health";

const HEALTH_LABEL: Record<GoogleIndexingRow["health"], string> = {
  healthy: "Healthy",
  warning: "Needs attention",
  excluded: "Intentionally excluded",
};
const HEALTH_COLOR: Record<GoogleIndexingRow["health"], { bg: string; fg: string }> = {
  healthy: { bg: "rgba(31,107,72,0.15)", fg: "#1F6B48" },
  warning: { bg: "rgba(183,71,42,0.15)", fg: "#B7472A" },
  excluded: { bg: "rgba(107,115,133,0.15)", fg: "#6B7385" },
};

/**
 * The Google SEO & Indexing table — a single interactive table
 * (search + type filter + health filter + sortable columns) rather
 * than long blocks of text, per explicit instruction. Rows come
 * pre-decorated from actions/google-infrastructure.ts; this component
 * only filters/sorts/paginates what it's given, no data-fetching of
 * its own.
 */
export function GoogleIndexingTable({ rows }: { rows: GoogleIndexingRow[] }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("health");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const pageTypes = useMemo(() => Array.from(new Set(rows.map((r) => r.pageType))).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (typeFilter !== "all" && r.pageType !== typeFilter) return false;
      if (healthFilter !== "all" && r.health !== healthFilter) return false;
      if (q && !r.title.toLowerCase().includes(q) && !r.path.toLowerCase().includes(q)) return false;
      return true;
    });
    const healthRank: Record<GoogleIndexingRow["health"], number> = { warning: 0, healthy: 1, excluded: 2 };
    out = out.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "health") cmp = healthRank[a.health] - healthRank[b.health];
      else cmp = a[sortKey].localeCompare(b[sortKey]);
      return cmp * sortDir;
    });
    return out;
  }, [rows, query, typeFilter, healthFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
    setPage(1);
  }

  const healthyCount = rows.filter((r) => r.health === "healthy").length;
  const warningCount = rows.filter((r) => r.health === "warning").length;
  const excludedCount = rows.filter((r) => r.health === "excluded").length;

  return (
    <div>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card"><div className="stat-label">Healthy</div><div className="stat-value">{healthyCount}</div><div className="stat-sub">Public, indexable, no issues</div></div>
        <div className="stat-card"><div className="stat-label">Needs attention</div><div className="stat-value">{warningCount}</div><div className="stat-sub">Eligible but a submission failed</div></div>
        <div className="stat-card"><div className="stat-label">Intentionally excluded</div><div className="stat-value">{excludedCount}</div><div className="stat-sub">Private/auth/API — expected, not a problem</div></div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search by title or path…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          className="field"
          style={{ maxWidth: 240, fontSize: 13 }}
        />
        <select className="field" style={{ maxWidth: 200, fontSize: 13 }} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="all">All page types</option>
          {pageTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="field" style={{ maxWidth: 200, fontSize: 13 }} value={healthFilter} onChange={(e) => { setHealthFilter(e.target.value); setPage(1); }}>
          <option value="all">All statuses</option>
          <option value="healthy">Healthy</option>
          <option value="warning">Needs attention</option>
          <option value="excluded">Intentionally excluded</option>
        </select>
        <span style={{ fontSize: 12, color: "var(--admin-text-faint, #6B7385)" }}>{filtered.length} of {rows.length} rows</span>
      </div>

      <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={TABLE_HEAD_STYLE} onClick={() => toggleSort("pageType")}>Type {sortKey === "pageType" ? (sortDir === 1 ? "↑" : "↓") : ""}</th>
              <th style={TABLE_HEAD_STYLE} onClick={() => toggleSort("title")}>Page {sortKey === "title" ? (sortDir === 1 ? "↑" : "↓") : ""}</th>
              <th style={TABLE_HEAD_STYLE}>Indexable</th>
              <th style={TABLE_HEAD_STYLE}>Sitemap</th>
              <th style={TABLE_HEAD_STYLE}>Robots</th>
              <th style={TABLE_HEAD_STYLE}>Canonical</th>
              <th style={TABLE_HEAD_STYLE} onClick={() => toggleSort("health")}>Health {sortKey === "health" ? (sortDir === 1 ? "↑" : "↓") : ""}</th>
              <th style={TABLE_HEAD_STYLE}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: "24px 14px", textAlign: "center", color: "var(--admin-text-faint, #6B7385)" }}>No rows match this search/filter.</td></tr>
            ) : (
              pageRows.map((r) => {
                const c = HEALTH_COLOR[r.health];
                return (
                  <tr key={r.url} title={r.reason}>
                    <td style={TABLE_CELL_STYLE}>{r.pageType}</td>
                    <td style={TABLE_CELL_STYLE}>
                      <div style={{ fontWeight: 700 }}>{r.title}</div>
                      <div style={{ color: "var(--admin-text-faint, #6B7385)", fontSize: 11.5 }}>{r.path}</div>
                    </td>
                    <td style={TABLE_CELL_STYLE}>{r.indexable ? "Yes" : "No"}</td>
                    <td style={TABLE_CELL_STYLE}>{r.sitemapIncluded ? "Included" : "Not included"}</td>
                    <td style={TABLE_CELL_STYLE}>{r.robotsStatus === "allowed" ? "Allowed" : "Disallowed"}</td>
                    <td style={TABLE_CELL_STYLE}>{r.canonicalStatus === "self-canonical" ? "Self-canonical" : "—"}</td>
                    <td style={TABLE_CELL_STYLE}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: c.bg, color: c.fg, whiteSpace: "nowrap" }}>
                        {HEALTH_LABEL[r.health]}
                      </span>
                    </td>
                    <td style={TABLE_CELL_STYLE}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--admin-accent, #5B8DEF)", fontSize: 11.5 }}>Open</a>
                        {r.indexable && (
                          <a href={r.inspectUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--admin-accent, #5B8DEF)", fontSize: 11.5 }}>Inspect in GSC</a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
          <button type="button" className="btn btn-ghost btn-small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span style={{ fontSize: 12.5, color: "var(--admin-text-faint, #6B7385)", alignSelf: "center" }}>Page {page} of {totalPages}</span>
          <button type="button" className="btn btn-ghost btn-small" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
