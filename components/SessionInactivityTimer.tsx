"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

const TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const;

/** Renders nothing — watches for real user activity (mouse, keyboard,
 * scroll, touch) and automatically signs the user out after 20 minutes
 * with none of it. Mounted once per account session (see
 * DashboardShell and AdminShell), not per page, so navigating between
 * pages doesn't reset the clock on its own — only genuine activity
 * does. */
export function SessionInactivityTimer() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        signOut({ redirect: false }).then(() => {
          window.location.href = "/login?timeout=1";
        });
      }, TIMEOUT_MS);
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, []);

  return null;
}
