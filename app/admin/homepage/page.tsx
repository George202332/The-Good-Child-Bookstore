import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminShell } from "@/components/AdminShell";
import { getHomepageContent } from "@/actions/cms";
import { HomepageEditor } from "./HomepageEditor";

/**
 * Homepage CMS — "Allow Admins to edit Hero... without changing code"
 * from the brief. Scoped to the hero block for now (eyebrow, heading,
 * description); featured books/categories/testimonials/footer are
 * already data-driven from the catalog and could be extended the same
 * way (more Setting keys) if needed.
 */
export default async function HomepageAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const content = await getHomepageContent();

  return (
    <AdminShell role="ADMIN" activeKey="homepage" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Homepage</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Edit the hero section shown at the top of the homepage.</p>
        </div>
      </div>
      <HomepageEditor initial={content} />
    </AdminShell>
  );
}
