"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { adminSignOut } from "@/actions/admin-auth";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const;

/** Renders nothing — watches for real user activity (mouse, keyboard,
 * scroll, touch) and automatically signs the user out after 30 minutes
 * with none of it. Mounted exactly once per session, from the
 * persistent route layout (app/account/layout.tsx for Reader/Author,
 * app/admin/layout.tsx for the backend roles) rather than from
 * individual pages' DashboardShell/AdminShell — a layout.tsx wraps
 * every current and future page under it automatically, including
 * pages that render their own full-screen chrome and skip those shells
 * entirely (the admin book-review screen was exactly this: it never
 * went through AdminShell, so it never had a running timer at all,
 * regardless of which role was reviewing). Previously this was mounted
 * from inside DashboardShell/AdminShell themselves, which only
 * protected the pages that remembered to render one of those two
 * components. Navigating between pages doesn't reset the clock on its
 * own — only genuine activity does.
 *
 * isAdmin picks the correct one of the two independent sessions to
 * sign out of, and the correct login page to land on afterward — the
 * public next-auth/react hook only ever clears the public session, so
 * using it inside the admin panel would silently leave the real admin
 * session cookie untouched. */
export function SessionInactivityTimer({ isAdmin = false }: { isAdmin?: boolean }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        if (isAdmin) await adminSignOut();
        else await signOut({ redirect: false });
        window.location.href = isAdmin ? "/admin/login?timeout=1" : "/login?timeout=1";
      }, TIMEOUT_MS);
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [isAdmin]);

  return null;
}
