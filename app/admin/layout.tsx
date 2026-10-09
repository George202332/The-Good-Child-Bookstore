import "./admin.css";
import { authAdmin } from "@/lib/auth-admin";
import { SessionInactivityTimer } from "@/components/SessionInactivityTimer";
import { BackNavigationGuard } from "@/components/BackNavigationGuard";

/** Loads the admin-only dark theme (see admin.css) — scoped to /admin via
 * Next.js's layout-based CSS loading, so it never affects any other route.
 *
 * Also mounts SessionInactivityTimer exactly once here, covering every
 * backend role (Admin/Editor/Chief Editor/Accountant) and every page
 * under /admin/**, including /admin/login (harmless there — nothing to
 * sign out of yet) and pages like the book-review screen that render
 * their own full-screen chrome instead of AdminShell. Previously the
 * timer only ever mounted from inside AdminShell, so any page that
 * skipped that component — the review screen did — had no inactivity
 * logout running at all. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Only read for its sign-in timestamp (so the inactivity timer ignores a
  // stale last-activity value from a previous session) — NOT a gate;
  // middleware and each page still do the real access checks.
  const session = await authAdmin();
  return (
    <>
      <SessionInactivityTimer isAdmin sessionStartedAt={session?.signedInAt} />
      <BackNavigationGuard isAdmin />
      {children}
    </>
  );
}
