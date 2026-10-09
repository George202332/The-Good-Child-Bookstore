"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { adminSignOut } from "@/actions/admin-auth";

/** Renders nothing — guards against the mobile "back button eventually
 * dumps you on the login screen" bug.
 *
 * The actual mechanism: /account/** and /admin/** each push a real
 * history entry per page visited (Links, router.push). The history
 * entry right below the very first one of those is whatever page was
 * open just before logging in — very often /login or /admin/login
 * itself, since that's usually the last page visited pre-login.
 * Pressing the device back button enough times walks back through
 * every dashboard page and eventually pops onto that pre-login entry.
 * Landing there doesn't actually end the session (the cookie is still
 * valid — see lib/session-cookie.ts for the separate fix about that),
 * but the public/admin login pages don't check for an existing session
 * themselves, so the user is shown a login form again with no "forward"
 * affordance to undo it — indistinguishable, to them, from being logged
 * out.
 *
 * Mounted once per authenticated session from app/account/layout.tsx
 * and app/admin/layout.tsx — both are shared layouts that persist
 * across every in-area navigation, so this effect's popstate listener
 * stays attached the whole time, not just on whichever page happened
 * to render it first.
 */
export function BackNavigationGuard({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const loginPath = isAdmin ? "/admin/login" : "/login";
  // The most recent URL we actually rendered dashboard content for —
  // never the login page itself — so a trapped back-navigation has a
  // real, current place to restore the address bar to.
  const lastDashboardPath = useRef(pathname);

  useEffect(() => {
    if (!pathname.startsWith(loginPath)) lastDashboardPath.current = pathname;
  }, [pathname, loginPath]);

  useEffect(() => {
    // Skipped inside an iframe (Responsive Preview tool) so the
    // embedded page never shows logout prompts or rewrites history.
    if (window.self !== window.top) return;
    function onPopState() {
      const landedOnLogin =
        window.location.pathname === loginPath || window.location.pathname.startsWith(`${loginPath}?`);
      if (!landedOnLogin) return;

      // The browser has already updated the address bar/history entry
      // by the time `popstate` fires — this pushes the real dashboard
      // URL straight back on top, canceling the exit at the
      // history-stack level, before asking whether it was intended.
      // (Next's own router also reacts to this same `popstate` event;
      // if it wins the race and briefly renders the login route before
      // this runs, this restores the URL immediately after and the next
      // client-side render re-syncs to it — see the amendment report
      // for the honest caveat on this.)
      history.pushState(null, "", lastDashboardPath.current);

      const wantsLogout = window.confirm("Going back will log you out of your account. Do you want to log out?");
      if (!wantsLogout) return;

      const activityKey = isAdmin ? "gcb-admin-last-activity" : "gcb-last-activity";
      try {
        localStorage.removeItem(activityKey);
      } catch {
        // Best-effort only.
      }
      const doSignOut = isAdmin ? adminSignOut() : signOut({ redirect: false });
      doSignOut
        .catch(() => {
          // Even if the sign-out call itself fails, still send them to
          // the login page rather than leaving them stuck.
        })
        .finally(() => {
          window.location.href = loginPath;
        });
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isAdmin, loginPath]);

  return null;
}
