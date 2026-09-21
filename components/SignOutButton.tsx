"use client";

import { signOut } from "next-auth/react";
import { adminSignOut } from "@/actions/admin-auth";

/** Converted from the "Sign out" button calling doLogout() (the-good-child-bookstore_54_1.html:6587).
 * Uses redirect: false and a manual hard navigation afterward — a soft
 * client-side redirect can land on a page Next.js's Router Cache had
 * already rendered while the user was still signed in, which looks
 * exactly like "logging back out failed" even though the session
 * cookie was actually cleared correctly. A full reload guarantees
 * every trace of the old signed-in state is gone, not just the cookie.
 *
 * isAdmin picks which of the two independent sessions actually gets
 * signed out — the public next-auth/react hook only ever clears the
 * public session's cookie, so using it inside the admin panel would
 * silently leave the real admin session cookie untouched. */
export function SignOutButton({ className, callbackUrl = "/", isAdmin = false }: { className?: string; callbackUrl?: string; isAdmin?: boolean }) {
  async function handleSignOut() {
    if (isAdmin) await adminSignOut();
    else await signOut({ redirect: false });
    window.location.href = callbackUrl;
  }
  return (
    <button type="button" className={className ?? "dashboard-sidebar-logout"} onClick={handleSignOut}>
      Sign out
    </button>
  );
}
