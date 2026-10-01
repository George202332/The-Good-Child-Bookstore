import "./admin.css";
import { SessionInactivityTimer } from "@/components/SessionInactivityTimer";

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
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionInactivityTimer isAdmin />
      {children}
    </>
  );
}
