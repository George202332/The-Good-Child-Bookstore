import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { SubmitBookForm } from "./SubmitBookForm";

/**
 * Submit New Title — a streamlined version of the original's much
 * larger submission flow (checklist UI, live cover-wrap preview, direct
 * manuscript/sample-page file uploads). Those file-upload pieces need
 * real file storage (S3/Cloudinary, etc.) wired in to work properly on
 * a server; that isn't set up yet, so this version takes a cover image
 * URL instead of an upload. Everything else is real: a genuine Book row
 * is created, an ISBN is generated, and it enters the same Draft →
 * Pending Review → Published workflow every other book goes through.
 */
export default async function NewBookPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");

  return (
    <DashboardShell role="AUTHOR" activeKey="mybooks" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Submit a new title</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Choose which formats to publish in — eBook, print, and audiobook can all be enabled from the same
            submission.
          </p>
        </div>
      </div>
      <SubmitBookForm />
    </DashboardShell>
  );
}
