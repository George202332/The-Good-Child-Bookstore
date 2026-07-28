import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { NewBookFormTabs } from "./NewBookFormTabs";

/**
 * Submit New Title — rebuilt to match the exact reference design
 * provided (both the eBook and Print Copy tabs), covering every section
 * shown: numbered steps, real file uploads, live checklist/preview for
 * eBook; real Lulu POD configuration, cover-wrap preview, and EAN-13
 * barcode generation for Print Copy. Audio book is not yet built to the
 * same depth.
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
            A professional publishing intake, organized the way our editorial and distribution teams process it.
          </p>
        </div>
      </div>
      <NewBookFormTabs />
    </DashboardShell>
  );
}
