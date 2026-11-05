import { readCapacity } from "@/lib/site-health/capacity";

/** "Capacity and speed" panel for Site Health: database connection use, error counts, response times, slow queries. Read-only. */
export async function SiteHealthCapacity() {
  const c = await readCapacity();
  const na = <span style={{ color: "var(--ink-faint)" }}>not available</span>;
  return (
    <section style={{ marginTop: 28 }} aria-label="Capacity and speed">
      <h3 style={{ fontSize: 17, marginBottom: 4 }}>Capacity and speed</h3>
      <p style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 12 }}>Real figures only. Anything that cannot be read says &quot;not available&quot;.</p>
      {c.warnings.length > 0 && (
        <div className="buybox-note" role="alert" style={{ marginBottom: 12 }}>
          {c.warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card"><div className="stat-label">Database connections</div><div className="stat-value">{c.connections ? `${c.connections.used} / ${c.connections.max}` : na}</div><div className="stat-sub">{c.connections ? `${c.connections.percent}% in use` : ""}</div></div>
        <div className="stat-card"><div className="stat-label">Errors, last hour</div><div className="stat-value">{c.errorsLastHour ?? na}</div><div className="stat-sub">Last 24 hours: {c.errorsLast24h ?? "not available"}</div></div>
        <div className="stat-card"><div className="stat-label">Paid orders, last 24 hours</div><div className="stat-value">{c.paidOrdersLast24h ?? na}</div></div>
      </div>
      <h4 style={{ fontSize: 14, margin: "8px 0" }}>Response times of the outside services (last 24 hours)</h4>
      {c.responseTimes.length === 0 ? <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>No checks recorded yet.</p> : (
        <table className="table"><thead><tr><th>Service</th><th>Average</th><th>95% finish within</th><th>Checks</th></tr></thead>
          <tbody>{c.responseTimes.map((r) => <tr key={r.service}><td>{r.service}</td><td>{r.avgMs} ms</td><td>{r.p95Ms} ms</td><td>{r.samples}</td></tr>)}</tbody></table>
      )}
      <h4 style={{ fontSize: 14, margin: "14px 0 8px" }}>Slowest recent database queries (over {c.slowQueryLimitMs} ms)</h4>
      {c.slowQueries.length === 0 ? <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>None seen by this server since it last started.</p> : (
        <table className="table"><thead><tr><th>Time</th><th>Query (values hidden)</th></tr></thead>
          <tbody>{c.slowQueries.map((q, i) => <tr key={i}><td>{q.ms} ms</td><td style={{ fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>{q.text}</td></tr>)}</tbody></table>
      )}
      <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 12 }}>
        Function time-outs are not reported to the site by Vercel, so they cannot be shown here. Check them in Vercel under Logs, filtered by status 504.
        The slow-query list is kept in memory per server instance, so it shows what that instance saw recently, not a full history.
      </p>
    </section>
  );
}
