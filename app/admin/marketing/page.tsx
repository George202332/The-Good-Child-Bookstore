import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { getMailingAudienceCounts } from "@/actions/marketing";
import { MailingListComposeForm } from "./MailingListComposeForm";

/**
 * The admin mailing-list tool — send one email to a whole audience
 * (opted-in readers, all authors, all active affiliates) or to
 * specific hand-picked recipients, using the same branded template
 * every other email in the app uses (see lib/email/template.ts).
 * Formerly just a "Marketing Email" page limited to opted-in readers —
 * see actions/marketing.ts for what changed and why.
 */
export default async function AdminMailingListPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const counts = await getMailingAudienceCounts();

  return (
    <AdminShell role="ADMIN" activeKey="marketing" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Mailing List</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Send one email to a whole group of accounts at once, or to specific people you pick. Every send uses the
            same branded template as the rest of the site&apos;s emails.
          </p>
        </div>
      </div>

      <MailingListComposeForm counts={counts} />
    </AdminShell>
  );
}
