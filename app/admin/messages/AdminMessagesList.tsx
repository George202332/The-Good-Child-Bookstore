"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InboxSummary } from "@/actions/admin-departments";
import { setStaffDepartment } from "@/actions/admin-departments";
import { DEPARTMENTS, departmentOf, type DepartmentKey } from "@/lib/message-departments";
import { WORKFLOW_LABELS } from "@/lib/message-meta";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** The department tabs (with a count of New and unread on each) and the list of conversations in the open inbox. */
export function AdminMessagesList({ inbox, active }: { inbox: InboxSummary; active: DepartmentKey | "ALL" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const tabs: { key: DepartmentKey | "ALL"; label: string }[] = [
    ...(inbox.isAdmin ? [{ key: "ALL" as const, label: "All Inboxes" }] : []),
    ...DEPARTMENTS.filter((d) => inbox.allowed.includes(d.key)).map((d) => ({ key: d.key, label: d.label })),
  ];

  async function toggle(userId: string, department: DepartmentKey, on: boolean) {
    setError(null);
    const r = await setStaffDepartment(userId, department, on);
    if (!r.ok) setError(r.error ?? "Something went wrong.");
    else router.refresh();
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {tabs.map((t) => (
          <Link key={t.key} href={`/admin/messages?d=${t.key}`} className={`view-tab ${active === t.key ? "active" : ""}`}>
            {t.label}{(inbox.counts[t.key] ?? 0) > 0 && <span className="msg-count">{inbox.counts[t.key]}</span>}
          </Link>
        ))}
      </div>

      {inbox.threads.length === 0 ? (
        <div className="map-card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Nothing in this inbox yet</div>
          <p style={{ color: "var(--admin-text-faint)", fontSize: 13 }}>Messages for this department will show up here.</p>
        </div>
      ) : (
        <div className="map-card" style={{ padding: 0 }}>
          {inbox.threads.map((c) => {
            const dept = departmentOf(c.department);
            return (
              <Link key={c.key} href={`/admin/messages/${c.counterpartId}?d=${c.department}`} style={{ display: "block", padding: "12px 16px", borderBottom: "1px solid var(--admin-line, var(--line))", color: "inherit", textDecoration: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <strong style={{ fontWeight: c.unread > 0 || c.status === "NEW" ? 800 : 600 }}>{c.counterpartName}</strong>
                  <span style={{ fontSize: 12, color: "var(--admin-text-faint)" }}>{when(c.lastAt)}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0", alignItems: "center" }}>
                  {dept && <span className="msg-badge" style={{ color: dept.color, background: dept.bg }}>{dept.label}</span>}
                  <span className="age-pill">{WORKFLOW_LABELS[c.status]}</span>
                  {c.automatic && <span className="age-pill">Automatic</span>}
                  <span style={{ fontSize: 12, color: "var(--admin-text-faint)" }}>{c.counterpartRole.charAt(0) + c.counterpartRole.slice(1).toLowerCase()}</span>
                </div>
                {c.subject && <div style={{ fontSize: 13.5 }}>{c.subject}</div>}
                {c.bookTitle && <div style={{ fontSize: 12.5, color: "var(--admin-text-faint)" }}>Book: {c.bookTitle} · SN {c.bookSn ?? "—"}</div>}
                <div style={{ fontSize: 13, color: "var(--admin-text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.lastBody}</div>
              </Link>
            );
          })}
        </div>
      )}

      {inbox.isAdmin && inbox.staff.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontSize: 15, marginBottom: 6 }}>Who Sees Which Inbox</h3>
          <p style={{ fontSize: 12.5, color: "var(--admin-text-faint)", marginBottom: 10 }}>
            A staff member can hold several departments. Editors, Chief Editors and Accountants keep their own department automatically; tick more to hand an inbox to someone (Payouts and Operations have no role of their own).
          </p>
          <div className="map-card" style={{ padding: 12, overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead><tr><th style={{ textAlign: "left", padding: 6 }}>Person</th>{DEPARTMENTS.map((d) => <th key={d.key} style={{ padding: 6 }}>{d.label}</th>)}</tr></thead>
              <tbody>
                {inbox.staff.map((u) => (
                  <tr key={u.id}>
                    <td style={{ padding: 6 }}>{u.name}<div style={{ fontSize: 11.5, color: "var(--admin-text-faint)" }}>{u.role.replace("_", " ").toLowerCase()}</div></td>
                    {DEPARTMENTS.map((d) => (
                      <td key={d.key} style={{ textAlign: "center", padding: 6 }}>
                        <input type="checkbox" aria-label={`${u.name}: ${d.label}`} checked={u.departments.includes(d.key)} disabled={u.role === "ADMIN"} onChange={(e) => toggle(u.id, d.key, e.target.checked)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <div className="field-hint" style={{ color: "var(--admin-danger)" }}>{error}</div>}
        </div>
      )}
    </>
  );
}
