import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminShell } from "@/components/AdminShell";
import { getReviewChecklistTemplate } from "@/lib/review-checklist";
import { ChecklistSettingsForm } from "./ChecklistSettingsForm";

/**
 * Lets an Admin define exactly what the review checklist asks for on
 * every book (Metadata: Title/Author/SN-ISBN, Appropriate: children's
 * book/age selection/copyright, etc.) — editable groups and items,
 * rather than a hardcoded list.
 */
export default async function ChecklistSettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/admin");

  const groups = await getReviewChecklistTemplate();

  return (
    <AdminShell role="ADMIN" activeKey="books-checklist" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Review Checklist</h2>
          <p style={{ color: "var(--ink-soft, var(--admin-text-faint))", fontSize: 13.5, marginTop: 2 }}>
            What editors and admins check off when reviewing a submission, before approving it.
          </p>
        </div>
      </div>
      <ChecklistSettingsForm initial={groups} />
    </AdminShell>
  );
}
