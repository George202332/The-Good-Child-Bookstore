import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { ResponsivePreview } from "./ResponsivePreview";

/**
 * Responsive Preview — shows the real live site inside a phone, tablet
 * or desktop sized frame. Available to Admin, Chief Editor and Editor.
 * Accountant and Investor are sent back to the dashboard (Investors
 * have their own separate area under /investor).
 */
export default async function ResponsivePreviewPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "EDITOR" && role !== "CHIEF_EDITOR") redirect("/admin");

  return (
    <AdminShell role={role} activeKey="responsive-preview" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 400 }}>Responsive Preview</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            See how the live site looks on a phone, a tablet and a desktop screen, without needing the devices.
          </p>
        </div>
      </div>
      <ResponsivePreview />
    </AdminShell>
  );
}
