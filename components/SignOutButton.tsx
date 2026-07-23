"use client";

import { signOut } from "next-auth/react";

/** Converted from the "Sign out" button calling doLogout() (the-good-child-bookstore_54_1.html:6587). */
export function SignOutButton() {
  return (
    <button type="button" className="dashboard-sidebar-logout" onClick={() => signOut({ callbackUrl: "/" })}>
      Sign out
    </button>
  );
}
