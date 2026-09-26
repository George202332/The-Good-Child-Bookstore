"use client";

import { useState } from "react";
import { UserRowActions } from "./UserRowActions";
import { getUserDetail, type UserDetail, type UserListRow } from "@/actions/users-admin";
import type { Role } from "@/lib/roles";

const TH: React.CSSProperties = {
  padding: "10px 12px", borderBottom: "1px solid var(--admin-border)", color: "var(--admin-text-faint)",
  fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", textAlign: "left", whiteSpace: "nowrap",
};
const TD: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid var(--admin-border)", fontSize: 13, verticalAlign: "middle" };

/**
 * The admin Users list, as an actual table (previously a stacked list
 * of rows, each just a name/email/role/account-number line with the
 * inline controls floated to the right — see git history of
 * app/admin/users/page.tsx). Columns per explicit request: name,
 * email, account type, account number, date joined, country. The role
 * dropdown, suspend, and delete controls (UserRowActions, unchanged)
 * stay inline in the row; clicking anywhere else in the row opens a
 * pop-up with that account's full profile (fetched on demand via
 * getUserDetail, since not everything — bio, genre, referral code —
 * fits in a table row).
 */
export function UsersTable({ users, currentUserId }: { users: UserListRow[]; currentUserId: string }) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function openDetail(userId: string) {
    setLoadingId(userId);
    const result = await getUserDetail(userId);
    setLoadingId(null);
    if (result) setDetail(result);
  }

  if (users.length === 0) {
    return <div style={{ padding: "20px 0", color: "var(--admin-text-faint)", fontSize: 13, textAlign: "center" }}>No accounts of this type yet.</div>;
  }

  return (
    <>
      <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH}>Name</th>
              <th style={TH}>Email</th>
              <th style={TH}>Account type</th>
              <th style={TH}>Account #</th>
              <th style={TH}>Date joined</th>
              <th style={TH}>Country</th>
              <th style={TH}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                onClick={() => openDetail(u.id)}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--admin-panel-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td style={TD}>
                  <span style={{ fontWeight: 700 }}>{u.name}</span>
                  {u.suspended && (
                    <span className="age-pill" style={{ marginLeft: 8, background: "var(--admin-danger)", color: "#fff" }}>Suspended</span>
                  )}
                  {u.id === currentUserId && <span className="age-pill" style={{ marginLeft: 8 }}>You</span>}
                </td>
                <td style={TD}>{u.email}</td>
                <td style={TD} onClick={(e) => e.stopPropagation()}>
                  {u.id === currentUserId ? (
                    u.role
                  ) : (
                    <RoleDropdownOnly userId={u.id} currentRole={u.role} />
                  )}
                </td>
                <td style={{ ...TD, fontFamily: "monospace" }}>{u.accountNumber}</td>
                <td style={TD}>{u.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                <td style={TD}>{u.location ?? "—"}</td>
                <td style={TD} onClick={(e) => e.stopPropagation()}>
                  {u.id !== currentUserId && <RowActionsOnly userId={u.id} currentRole={u.role} suspended={u.suspended} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(detail || loadingId) && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setDetail(null)}
        >
          <div
            style={{ background: "var(--admin-panel)", border: "1px solid var(--admin-border)", borderRadius: 14, padding: 22, maxWidth: 520, width: "100%", position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: detail ? 4 : 0 }}>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => setDetail(null)}
              >
                Cancel
              </button>
            </div>
            {loadingId && !detail ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "var(--admin-text-faint)", fontSize: 13 }}>Loading…</div>
            ) : detail ? (
              <div>
                <h3 style={{ fontSize: 17, marginBottom: 4 }}>{detail.name}</h3>
                <p style={{ fontSize: 12.5, color: "var(--admin-text-faint)", marginBottom: 16 }}>#{detail.accountNumber} · {detail.role}{detail.suspended ? " · Suspended" : ""}</p>
                <DetailRow label="Email" value={detail.email} />
                <DetailRow label="Date joined" value={detail.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} />
                <DetailRow label="Country" value={detail.location ?? "—"} />
                {detail.role === "AUTHOR" && (
                  <>
                    <DetailRow label="Author bio" value={detail.authorBio ?? "—"} />
                    <DetailRow label="Primary genre" value={detail.authorPrimaryGenre ?? "—"} />
                  </>
                )}
                {detail.affiliateReferralCode && <DetailRow label="Affiliate referral code" value={detail.affiliateReferralCode} />}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid var(--admin-border)" }}>
      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--admin-text-faint)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: "var(--admin-text)" }}>{value}</div>
    </div>
  );
}

/** Thin wrappers around UserRowActions so the role dropdown and the
 * suspend/delete buttons can sit in their own separate table cells
 * (matching the column layout) while still sharing the exact same
 * server actions and confirmation behavior as before. */
function RoleDropdownOnly({ userId, currentRole }: { userId: string; currentRole: Role }) {
  return <UserRowActions userId={userId} currentRole={currentRole} suspended={false} mode="role" />;
}
function RowActionsOnly({ userId, currentRole, suspended }: { userId: string; currentRole: Role; suspended: boolean }) {
  return <UserRowActions userId={userId} currentRole={currentRole} suspended={suspended} mode="actions" />;
}
