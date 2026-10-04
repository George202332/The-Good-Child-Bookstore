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
 * cookie untouched.
 *
 * FRESH re-investigation (Amendment 11) — "confirmed broken on mobile
 * specifically", both the inactivity timeout AND the close-tab/browser
 * logout (lib/session-cookie.ts). Root cause for BOTH, found by
 * thinking through what "the tab is still open" actually means on a
 * phone, not a desktop:
 *
 * On desktop, a backgrounded/minimized browser tab's JS process keeps
 * running continuously (just throttled) for as long as the browser
 * itself stays open — which is exactly why the weaknesses fixed in the
 * "later round" comment above (ref lost on remount, one long throttled
 * setTimeout) were the right things to fix there. On mobile, switching
 * away from the browser app (home button, app switcher, screen lock) is
 * NOT the same as closing it — but iOS/Android can, and routinely do,
 * fully evict a backgrounded tab's entire JS process under ordinary
 * memory pressure, often within minutes, with zero warning and no
 * event this code (or any code) gets to react to. When the user comes
 * back, that tab's JS reloads from scratch — this component remounts
 * as if the page had just been opened fresh.
 *
 * That remount is precisely where the OLD version (sessionStorage-only)
 * silently broke the entire mobile case: sessionStorage belongs to the
 * BROWSER PROCESS for that tab, not the page — once iOS/Android evicts
 * the tab's process, that storage is gone too, by design (it's not
 * meant to survive the process it lives in). On reload,
 * `readLastActivity()` found nothing, fell back to `Date.now()`, and
 * the brand-new component instance concluded "last activity was just
 * now" — even if the phone had actually been locked in a pocket for 6
 * hours. There was no bug in the 15s-interval / visibilitychange
 * "catch-up check on resume" pattern itself (that part is sound and
 * kept as-is) — the real elapsed-time check it performs was simply
 * being handed the WRONG "last known activity" time to compare against,
 * because its only source of truth didn't survive the one thing mobile
 * actually does to backgrounded tabs.
 *
 * The fix: back this with `localStorage` instead of `sessionStorage`.
 * localStorage is scoped to the origin, not the tab's process — it
 * physically survives exactly the kind of OS-level eviction/relaunch
 * described above (and, for that matter, actually closing and
 * reopening the browser app entirely), so a freshly-reloaded instance
 * of this component on mobile now reads back the REAL last-activity
 * timestamp and its very next `checkIdle()` tick (still fired
 * immediately on mount, as before) correctly recognizes "it's been way
 * past 30 minutes" instead of wrongly resetting the clock to zero. A
 * `pageshow` listener is added alongside `visibilitychange` as a second,
 * more reliable resume signal specifically for the back-forward-cache
 * (bfcache) case common on mobile Safari — a page restored from bfcache
 * keeps its JS state (timers resume, no remount at all), but
 * `visibilitychange` isn't guaranteed to fire on every bfcache restore
 * path the way `pageshow`'s own `persisted` flag reliably does.
 *
 * This same mechanism also now covers "closing the tab/window" on
 * mobile, which the session-cookie approach (lib/session-cookie.ts)
 * fundamentally cannot: a true session cookie's whole premise is "gone
 * when the browser process quits", but on a phone the browser process
 * essentially never quits from the user's perspective (backgrounding
 * isn't quitting, and the user has no reliable way to force a "real"
 * quit either) — there is no mobile-exposed event for "the user closed
 * this". What IS real and durable on mobile is exactly what this fix
 * now tracks correctly: elapsed real time since the last genuine touch,
 * checked the instant the tab is usable again, whether that's a normal
 * resume or a full reload after OS eviction — so walking away from the
 * site on a phone and not coming back for 30+ minutes now reliably
 * results in a logged-out session the next time it's opened, even
 * though the underlying session cookie itself may still technically be
 * alive. The cookie's own `exp` claim (unchanged, lib/auth.ts /
 * lib/auth-admin.ts `session.maxAge`) remains the hard outer backstop
 * for the (rare) case where even this never gets a chance to run.
 */
export function SessionInactivityTimer({ isAdmin = false }: { isAdmin?: boolean }) {
  const loggedOutRef = useRef(false);

  useEffect(() => {
    const storageKey = isAdmin ? "gcb-admin-last-activity" : "gcb-last-activity";

    function readLastActivity(): number {
      // localStorage, not sessionStorage — see the module comment above:
      // sessionStorage doesn't survive a mobile OS evicting this tab's
      // backgrounded process, which is a routine occurrence on phones,
      // not an edge case. localStorage does, so a freshly-reloaded
      // instance of this component (after exactly that kind of eviction
      // and relaunch) still reads back the real last-activity time
      // instead of wrongly assuming "just now".
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const n = Number(stored);
          if (Number.isFinite(n)) return n;
        }
      } catch {
        // localStorage can throw in some privacy modes — fall through.
      }
      return Date.now();
    }

    let lastActivity = readLastActivity();

    function markActive() {
      lastActivity = Date.now();
      try {
        localStorage.setItem(storageKey, String(lastActivity));
      } catch {
        // Best-effort only — the in-memory value above still works for
        // this tab even if localStorage can't be written to.
      }
    }

    async function checkIdle() {
      if (loggedOutRef.current) return;
      if (Date.now() - lastActivity < TIMEOUT_MS) return;
      loggedOutRef.current = true;
      try {
        localStorage.removeItem(storageKey);
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
    // `pageshow` (checked via `persisted`) is the more reliable mobile
    // resume signal for a page restored from the back-forward cache —
    // see the module comment above. Harmless/redundant alongside
    // `visibilitychange` on desktop, where that event alone is enough.
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) checkIdle();
    }
    window.addEventListener("pageshow", onPageShow);
    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS);
    // Covers the case where this component mounts (or remounts) after
    // the real last-activity time on record is already past the limit —
    // e.g. the tab was asleep well past 30 minutes before this effect
    // got a chance to run at all, or (mobile) the tab's whole process
    // was evicted and just reloaded fresh.
    checkIdle();

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActive));
      document.removeEventListener("visibilitychange", checkIdle);
      window.removeEventListener("pageshow", onPageShow);
      clearInterval(interval);
    };
  }, [isAdmin]);

  return null;
}
