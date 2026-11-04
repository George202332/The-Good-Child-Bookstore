import type { ServiceResult } from "@/lib/service-checks";
import type { ServiceState } from "@/lib/site-health/service-state";

/** Read-only status of every outside service. Shows the mode, whether the key is present, the result of the last harmless
 * check and (for a failure) a plain reason. Never shows a key; variable NAMES only. */
export function ServiceStatusTable({ results, states }: { results: ServiceResult[]; states?: Partial<Record<string, ServiceState>> }) {
  if (results.length === 0) {
    return <p style={{ fontSize: 13.5 }}>No check has run yet. Press <strong>Check now</strong>.</p>;
  }
  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
      {results.map((r) => {
        const st = states?.[r.key];
        return (
          <div key={r.key} className="map-card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong>{r.label}</strong>
              <span className={`health-pill ${r.ok ? "health-ok" : "health-error"}`}>{r.ok ? "Working" : "Not working"}</span>
            </div>
            <dl style={{ margin: "10px 0 0", fontSize: 13, display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 10px" }}>
              <dt style={{ color: "var(--admin-text-faint)" }}>Mode</dt>
              <dd style={{ margin: 0 }}>{r.mode === "live" ? "Live (real)" : r.mode === "test" ? "Test (no real money)" : "-"}</dd>
              <dt style={{ color: "var(--admin-text-faint)" }}>Key set?</dt>
              <dd style={{ margin: 0 }}>{r.keyPresent ? "Yes" : "No"}</dd>
              <dt style={{ color: "var(--admin-text-faint)" }}>Response time</dt>
              <dd style={{ margin: 0 }}>{r.responseMs != null ? `${r.responseMs} ms` : "-"}</dd>
              <dt style={{ color: "var(--admin-text-faint)" }}>Last check</dt>
              <dd style={{ margin: 0 }}>{new Date(r.checkedAt).toLocaleString()}</dd>
              {st && !st.ok && (<><dt style={{ color: "var(--admin-text-faint)" }}>Down since</dt><dd style={{ margin: 0 }}>{new Date(st.since).toLocaleString()}</dd></>)}
              <dt style={{ color: "var(--admin-text-faint)" }}>Variables</dt>
              <dd style={{ margin: 0, fontFamily: "monospace", fontSize: 12 }}>{r.variables.join(", ")}</dd>
            </dl>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: r.ok ? "inherit" : "#d64545" }}>{r.ok ? r.note : r.reason}</p>
          </div>
        );
      })}
    </div>
  );
}
