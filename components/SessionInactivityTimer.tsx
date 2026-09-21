"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { adminSignOut } from "@/actions/admin-auth";

const TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const;

/** Renders nothing — watches for real user activity (mouse, keyboard,
 * scroll, touch) and automatically signs the user out after 20 minutes
 * with none of it. Mounted once per account session (see
 * DashboardShell and AdminShell), not per page, so navigating between
 * pages doesn't reset the clock on its own — only genuine activity
 * does.
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
