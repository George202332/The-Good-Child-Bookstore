"use client";

import { useMemo, useState, type ReactNode } from "react";
import { UsersTable } from "./UsersTable";
import type { UserListRow } from "@/actions/users-admin";

/**
 * Wraps the role-tab links and the users table with a client-side search
 * box — "search for a user by name, account number, or email", sitting
 * directly below the create-account card. The role tabs are passed in as
 * children (server-rendered by the page) so switching role still works
 * as a normal navigation, while the text search filters whichever
 * role-filtered set the server already sent down, entirely client-side.
 */
export function UsersDirectory({
  users,
  currentUserId,
  children,
}: {
  users: UserListRow[];
  currentUserId: string;
  children?: ReactNode;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.accountNumber.toLowerCase().includes(q)
    );
  }, [users, query]);

  return (
    <>
      <div style={{ margin: "20px 0 0", maxWidth: 380 }}>
        <input
          type="search"
          className="field field-compact"
          style={{ marginBottom: 0 }}
          placeholder="Search by name, account number, or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search users"
        />
        {query && (
          <p className="field-hint" style={{ marginTop: 6 }}>
            {filtered.length} of {users.length} match.
          </p>
        )}
      </div>

      {children}

      <UsersTable users={filtered} currentUserId={currentUserId} />
    </>
  );
}
