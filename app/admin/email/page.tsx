import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { getGoogleConnectionStatus } from "@/actions/google-email";
import { EmailClient } from "./EmailClient";

export default async function AdminEmailPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const connection = await getGoogleConnectionStatus();

  return (
    <AdminShell role="ADMIN" activeKey="email" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Email</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            {connection.connected ? `Connected as ${connection.email}` : "Connect a Gmail account to get started."}
          </p>
        </div>
      </div>

      {connection.connected ? (
        <EmailClient />
      ) : (
        <div className="map-card" style={{ padding: 24, textAlign: "center" }}>
          <p style={{ marginBottom: 14 }}>No Gmail account is connected yet.</p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- real API route + external redirect to Google, not a Next.js page */}
          <a href="/api/integrations/google/auth" className="btn btn-primary btn-small">Connect Gmail account</a>
          <p className="field-hint" style={{ marginTop: 10 }}>
            Needs a Google Client ID and Secret set first in Admin → API Management → Google Workspace Configuration.
          </p>
        </div>
      )}
    </AdminShell>
  );
}
