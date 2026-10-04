import "../admin/admin.css";
import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { SessionInactivityTimer } from "@/components/SessionInactivityTimer";
import { BackNavigationGuard } from "@/components/BackNavigationGuard";

export const dynamic = "force-dynamic";

/**
 * The gate every /investor/** page passes through (Amendment 12) —
 * mirrors app/admin/layout.tsx exactly (same admin-only session,
 * same dark theme, same inactivity timer mounted once here so no page
 * under this route can accidentally skip it), restricted to the
 * INVESTOR role (plus ADMIN, so an Admin can preview this area without
 * needing a second account). Every other backend role is refused here,
 * the same way a reader/author credential doesn't work on /admin/login
 * at all — this is a genuinely separate, read-only surface, not a
 * reachable-by-accident corner of the admin backend.
 */
export default async function InvestorLayout({ children }: { children: React.ReactNode }) {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "INVESTOR" && role !== "ADMIN") redirect("/admin");

  return (
    <>
      <SessionInactivityTimer isAdmin />
      <BackNavigationGuard isAdmin />
      {children}
    </>
  );
}
