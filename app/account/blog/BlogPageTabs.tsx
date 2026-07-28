"use client";

import { useState } from "react";
import Link from "next/link";
import { BlogEditorForm, type EditingBlogPost } from "./BlogEditorForm";
import { SubmitButton } from "./SubmitButton";

export interface BlogListItem {
  id: string;
  slug: string | null;
  title: string;
  content: string;
  coverImageUrl: string | null;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
  createdAt: string;
  authorName: string;
  isMine: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "In review",
  PUBLISHED: "Published",
  REJECTED: "Needs changes",
  ARCHIVED: "Archived",
};
const STATUS_CLASS: Record<string, string> = {
  DRAFT: "status-draft",
  PENDING_REVIEW: "status-review",
  PUBLISHED: "status-published",
  REJECTED: "status-review",
  ARCHIVED: "status-draft",
};

/** Landing state is always the list — matches "an author clicks on
 * blog, they should first land on the list of blogs with details."
 * "Submit a new blog" sits top-left as its own tab (same pattern as the
 * Submit a new title eBook/Print tabs), and clicking Edit on one of the
 * author's own draft/rejected posts switches to that tab pre-filled. */
export function BlogPageTabs({ posts }: { posts: BlogListItem[] }) {
  const [tab, setTab] = useState<"list" | "submit">("list");
  const [editingPost, setEditingPost] = useState<EditingBlogPost | undefined>(undefined);

  function startNewPost() {
    setEditingPost(undefined);
    setTab("submit");
  }

  function startEditingPost(p: BlogListItem) {
    setEditingPost({ id: p.id, title: p.title, content: p.content, coverImageUrl: p.coverImageUrl });
    setTab("submit");
  }

  function backToList() {
    setEditingPost(undefined);
    setTab("list");
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button type="button" className={`btn btn-small ${tab === "list" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("list")}>
          Your posts
        </button>
        <button type="button" className={`btn btn-small ${tab === "submit" ? "btn-primary" : "btn-ghost"}`} onClick={startNewPost}>
          Submit a new blog
        </button>
      </div>

      {tab === "submit" && (
        <BlogEditorForm editingPost={editingPost} onDone={backToList} />
      )}

      {tab === "list" && (
        <>
          <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 24, maxWidth: 600 }}>
            Posts written by authors on the platform (reading tips, behind-the-scenes notes, and interviews). New
            posts are checked by our support team before they go live.
          </p>
          {posts.length === 0 ? (
            <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No posts yet; be the first to write one.</div>
          ) : (
            <div className="blog-grid">
              {posts.map((p) => {
                const canEdit = p.isMine && (p.status === "DRAFT" || p.status === "REJECTED");
                const canView = p.status === "PUBLISHED" && p.slug;
                const card = (
                  <>
                    <div className="blog-cover" style={{ background: "var(--lavender)" }}>
                      {p.coverImageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- author's own blog-card cover
                        <img src={p.coverImageUrl} alt={p.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
                      )}
                    </div>
                    <div className="blog-body">
                      <div className="blog-cat">
                        {p.isMine && <span className={`status-pill ${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>}
                      </div>
                      <h3>{p.title}</h3>
                      <p>{p.content.slice(0, 160)}{p.content.length > 160 ? "…" : ""}</p>
                      <div className="blog-meta">
                        <span>by {p.authorName}</span>
                        <span>{new Date(p.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                      </div>
                      {p.isMine && (canEdit || p.status === "PENDING_REVIEW") && (
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          {canEdit && (
                            <button type="button" className="btn btn-ghost btn-small" onClick={() => startEditingPost(p)}>
                              Edit
                            </button>
                          )}
                          {p.status === "DRAFT" && <SubmitButton blogId={p.id} />}
                        </div>
                      )}
                    </div>
                  </>
                );
                return canView ? (
                  <Link key={p.id} href={`/blog/${p.slug}`} className="blog-card-v2">{card}</Link>
                ) : (
                  <div key={p.id} className="blog-card-v2">{card}</div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
