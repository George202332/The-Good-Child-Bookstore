"use client";

import { useState } from "react";
import { UserRowActions } from "./UserRowActions";
import { UserActivityLog } from "./UserActivityLog";
import { ColHelp } from "@/components/ColHelp";
import { FullScreenPanel } from "@/components/FullScreenPanel";
import { TH_STYLE, TD_STYLE } from "@/components/admin-table";
import { getUserDetail, getUserActivityLog, type UserDetail, type UserActivityLogEntry, type UserListRow } from "@/actions/users-admin";
import type { Role } from "@/lib/roles";

const TH: React.CSSProperties = { ...TH_STYLE, padding: "10px 12px", borderBottom: "1px solid var(--admin-border)", color: "var(--admin-text-faint)", fontSize: 11, letterSpacing: "0.03em" };
const TD: React.CSSProperties = { ...TD_STYLE, padding: "10px 12px", borderBottom: "1px solid var(--admin-border)", fontSize: 13, verticalAlign: "middle" };

/**
 * The admin Users list, as an actual table (previously a stacked list
 * of rows, each just a name/email/role/account-number line with the
 * inline controls floated to the right — see git history of
 * app/admin/users/page.tsx). Columns per explicit request: account ID,
 * name, email, date joined, country, account type, then suspend/delete
 * actions. The role dropdown, suspend, and delete controls (UserRowActions, unchanged)
 * stay inline in the row; clicking anywhere else in the row opens a
 * pop-up with that account's full profile (fetched on demand via
 * getUserDetail, since not everything — bio, genre, referral code —
 * fits in a table row).
 */
export function UsersTable({ users, currentUserId }: { users: UserListRow[]; currentUserId: string }) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [activity, setActivity] = useState<UserActivityLogEntry[] | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function closeDetail() {
    setDetail(null);
    setActivity(null);
  }

  async function openDetail(userId: string) {
    setLoadingId(userId);
    const [result, log] = await Promise.all([getUserDetail(userId), getUserActivityLog(userId)]);
    setLoadingId(null);
    if (result) {
      setDetail(result);
      setActivity(log);
    }
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
              <th style={TH}>Account ID<ColHelp text="This user's unique account number on the platform." /></th>
              <th style={TH}>Name<ColHelp text="The name on the account." /></th>
              <th style={TH}>Email<ColHelp text="The email address this account signs in and receives notifications with." /></th>
              <th style={TH}>Date joined<ColHelp text="When this account was created." /></th>
              <th style={TH}>Country<ColHelp text="The country on file for this account, from their profile or default shipping address." /></th>
              <th style={TH}>Account type<ColHelp text="This account's role — Reader, Author, Editor, Chief Editor, Admin, or Accountant. Change it from the dropdown in this column." /></th>
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
                <td style={{ ...TD, fontFamily: "monospace" }}>{u.accountNumber}</td>
                <td style={TD}>
                  <span style={{ fontWeight: 700 }}>{u.name}</span>
                  {u.suspended && (
                    <span className="age-pill" style={{ marginLeft: 8, background: "var(--admin-danger)", color: "#1B0A0A" }}>Suspended</span>
                  )}
                  {u.id === currentUserId && <span className="age-pill" style={{ marginLeft: 8 }}>You</span>}
                </td>
                <td style={TD}>{u.email}</td>
                <td style={TD}>{u.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                <td style={TD}>{u.location ?? "—"}</td>
                <td style={TD} onClick={(e) => e.stopPropagation()}>
                  {u.id === currentUserId ? (
                    u.role
                  ) : (
                    <RoleDropdownOnly userId={u.id} currentRole={u.role} />
                  )}
                </td>
                <td style={TD} onClick={(e) => e.stopPropagation()}>
                  {u.id !== currentUserId && <RowActionsOnly userId={u.id} currentRole={u.role} suspended={u.suspended} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(detail || loadingId) && (
        <FullScreenPanel onClose={closeDetail}>
            {loadingId && !detail ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "var(--admin-text-faint)", fontSize: 13 }}>Loading…</div>
            ) : detail ? (
              <div>
                <h3 style={{ fontSize: 20, marginBottom: 4 }}>{detail.name}</h3>
                <p style={{ fontSize: 12.5, color: "var(--admin-text-faint)", marginBottom: 20 }}>#{detail.accountNumber} · {detail.role}{detail.suspended ? " · Suspended" : ""}</p>
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

                <h4 style={{ fontSize: 14, marginTop: 32, marginBottom: 8 }}>Activity log</h4>
                <p style={{ fontSize: 12, color: "var(--admin-text-faint)", marginBottom: 12 }}>
                  Login timestamps, IP/device info, password reset events, and role changes for this account.
                </p>
                <UserActivityLog entries={activity ?? []} />
              </div>
            ) : null}
        </FullScreenPanel>
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
