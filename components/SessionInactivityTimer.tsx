"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { adminSignOut } from "@/actions/admin-auth";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
// Checked on a short recurring interval instead of relying on one single
// 30-minute setTimeout — browsers throttle (sometimes heavily) timers in
// a backgrounded or minimized tab, which is exactly the situation this
// feature is supposed to catch, so a lone long-duration setTimeout could
// silently fire minutes or even longer after it was actually due. A
// short interval is throttled far less aggressively, and each tick
// checks the real elapsed wall-clock time (Date.now()), not "has this
// particular timer fired yet" — so it still catches up correctly even
// if a tick or two was itself delayed.
const CHECK_INTERVAL_MS = 15 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const;

/** Renders nothing — watches for real user activity (mouse, keyboard,
 * scroll, touch) and automatically signs the user out after 30 minutes
 * with none of it. Mounted exactly once per session, from the
 * persistent route layout (app/account/layout.tsx for Reader/Author,
 * app/admin/layout.tsx for the backend roles) rather than from
 * individual pages' DashboardShell/AdminShell — a layout.tsx wraps
 * every current and future page under it automatically, including
 * pages that render their own full-screen chrome and skip those shells
 * entirely. Navigating between pages doesn't reset the clock on its
 * own — only genuine activity does.
 *
 * Rebuilt in a later round after the 30-minute timeout still wasn't
 * actually firing in practice. Two real weaknesses in the original
 * single-setTimeout version, now both addressed:
 *
 *  1. The last-activity clock lived only in a React ref. If this
 *     component were ever remounted (losing that ref) by something
 *     elsewhere on an account/admin page re-rendering the layout around
 *     it — a `router.refresh()` call, for instance, which several pages
 *     use for "live" data — the whole 30-minute count silently started
 *     over from zero, with no real user activity involved at all. The
 *     last-activity timestamp now also lives in sessionStorage (one
 *     per tab, separate keys for the public vs admin session), so a
 *     remount reads back the real elapsed time instead of resetting it.
 *
 *  2. A single long setTimeout is exactly the kind of timer browsers
 *     throttle hardest in a backgrounded/minimized tab or a sleeping
 *     laptop — it can fire very late, sometimes long after it was due,
 *     rather than not at all. Checking real elapsed time on a short
 *     recurring interval (and once more on visibilitychange, so
 *     switching back to the tab after it was asleep is checked
 *     immediately rather than waiting for the next tick) means the
 *     actual wall-clock time is what decides whether to log out, not
 *     whether one particular timer happened to fire on schedule.
 *
 * isAdmin picks the correct one of the two independent sessions to sign
 * out of, and the correct login page to land on afterward — the public
 * next-auth/react hook only ever clears the public session, so using it
 * inside the admin panel would silently leave the real admin session
 * cookie untouched. */
export function SessionInactivityTimer({ isAdmin = false }: { isAdmin?: boolean }) {
  const loggedOutRef = useRef(false);

  useEffect(() => {
    const storageKey = isAdmin ? "gcb-admin-last-activity" : "gcb-last-activity";

    function readLastActivity(): number {
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const n = Number(stored);
          if (Number.isFinite(n)) return n;
        }
      } catch {
        // sessionStorage can throw in some privacy modes — fall through.
      }
      return Date.now();
    }

    let lastActivity = readLastActivity();

    function markActive() {
      lastActivity = Date.now();
      try {
        sessionStorage.setItem(storageKey, String(lastActivity));
      } catch {
        // Best-effort only — the in-memory value above still works for
        // this tab even if sessionStorage can't be written to.
      }
    }

    async function checkIdle() {
      if (loggedOutRef.current) return;
      if (Date.now() - lastActivity < TIMEOUT_MS) return;
      loggedOutRef.current = true;
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // Not critical — the redirect below is what actually matters.
      }
      // The actual sign-out call is network-bound (a Server Action for
      // admin, a fetch to /api/auth/signout for reader/author) and can
      // fail transiently. It used to sit outside any try/catch here, so
      // a failed call threw out of checkIdle() entirely, skipped the
      // redirect below, and — since loggedOutRef was already flipped to
      // true just above — every later 15s tick returned immediately
      // without ever retrying: the tab was left open, apparently idle,
      // with no logout and no way to recover short of a full reload.
      // Wrapped so the redirect to the login page always happens even
      // if the sign-out call itself errors (the session cookie's own
      // expiry — see lib/session-cookie.ts / session.maxAge — is still
      // the backstop if a failed call somehow left it intact).
      try {
        if (isAdmin) await adminSignOut();
        else await signOut({ redirect: false });
      } catch {
        // Fall through to the redirect regardless.
      } finally {
        window.location.href = isAdmin ? "/admin/login?timeout=1" : "/login?timeout=1";
      }
    }

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));
    document.addEventListener("visibilitychange", checkIdle);
    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS);
    // Covers the case where this component mounts (or remounts) after
    // the real last-activity time on record is already past the limit —
    // e.g. the tab was asleep well past 30 minutes before this effect
    // got a chance to run at all.
    checkIdle();

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActive));
      document.removeEventListener("visibilitychange", checkIdle);
      clearInterval(interval);
    };
  }, [isAdmin]);

  return null;
}
