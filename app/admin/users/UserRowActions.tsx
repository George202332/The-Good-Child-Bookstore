"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUserRole, deleteUserAccount, toggleUserSuspension } from "@/actions/users-admin";
import type { Role } from "@/lib/roles";

const ROLES: Role[] = ["READER", "AUTHOR", "AFFILIATE", "EDITOR", "ADMIN", "ACCOUNTANT"];

export function UserRowActions({ userId, currentRole, suspended }: { userId: string; currentRole: Role; suspended: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {error && <span style={{ fontSize: 12, color: "var(--coral-deep, var(--admin-danger))" }}>{error}</span>}
      <select
        className="field"
        style={{ marginBottom: 0, width: "auto", padding: "6px 10px", fontSize: 12.5 }}
        defaultValue={currentRole}
        disabled={isPending}
        onChange={(e) =>
          startTransition(async () => {
            const res = await updateUserRole(userId, e.target.value as Role);
            if (!res.ok) setError(res.error ?? "Failed");
            else router.refresh();
          })
        }
      >
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <button
        type="button"
        className="btn btn-ghost btn-small"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await toggleUserSuspension(userId);
            if (!res.ok) setError(res.error ?? "Failed");
            else router.refresh();
          })
        }
      >
        {suspended ? "Reactivate" : "Suspend"}
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-small"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Delete this account permanently?")) return;
          startTransition(async () => {
            const res = await deleteUserAccount(userId);
            if (!res.ok) setError(res.error ?? "Failed");
            else router.refresh();
          });
        }}
      >
        Delete
      </button>
    </div>
  );
}
