import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { BlogEditorForm } from "./BlogEditorForm";
import { SubmitButton } from "./SubmitButton";

interface OwnBlog {
  id: string;
  title: string;
  status: string;
  createdAt: Date;
}

/**
 * Author's Blog — write, save as draft, and submit for review. New
 * functionality (the original's author blog pages were localStorage-only
 * and not tied to the real editorial workflow the brief describes).
 */
export default async function AuthorBlogPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { authorProfile: { include: { blogs: { orderBy: { createdAt: "desc" } } } } },
  });
  const posts = (user?.authorProfile?.blogs ?? []) as OwnBlog[];

  return (
    <DashboardShell role="AUTHOR" activeKey="blog" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Blog</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Write a new post, or manage your existing ones.</p>
        </div>
      </div>

      <BlogEditorForm />

      <h3 style={{ fontSize: 16, margin: "24px 0 14px" }}>Your posts</h3>
      {posts.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>Nothing written yet.</div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {posts.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  {p.status} · {p.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
              </div>
              {p.status === "DRAFT" && <SubmitButton blogId={p.id} />}
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
