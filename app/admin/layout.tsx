import "./admin.css";

/** Loads the admin-only dark theme (see admin.css) — scoped to /admin via
 * Next.js's layout-based CSS loading, so it never affects any other route. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
