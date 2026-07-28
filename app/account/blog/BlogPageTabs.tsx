"use client";

import { useState } from "react";
import Link from "next/link";
import { BlogEditorForm, type EditingBlogPost } from "./BlogEditorForm";
import { SubmitButton } from "./SubmitButton";

export interface BlogListItem {
  id: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  content: string;
  shortSummary: string | null;
  coverImageUrl: string | null;
  imageAltText: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  categories: string[];
  tags: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  seoKeywords: string | null;
  canonicalUrl: string | null;
  featured: boolean;
  allowComments: boolean;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
  createdAt: string;
  publishAt: string | null;
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

/** Landing state is always the list. "Submit a new blog" sits top-left
 * as its own tab, and Edit on one of the writer's own draft/rejected
 * posts switches to that tab pre-filled with every field. Open to every
 * account type (Reader, Author, Affiliate) — the parent page passes
 * defaultAuthorName from whoever is signed in. */
export function BlogPageTabs({ posts, defaultAuthorName }: { posts: BlogListItem[]; defaultAuthorName: string }) {
  const [tab, setTab] = useState<"list" | "submit">("list");
  const [editingPost, setEditingPost] = useState<EditingBlogPost | undefined>(undefined);

  function startNewPost() {
    setEditingPost(undefined);
    setTab("submit");
  }

  function startEditingPost(p: BlogListItem) {
    setEditingPost({
      id: p.id,
      title: p.title,
      subtitle: p.subtitle,
      slug: p.slug ?? "",
      content: p.content,
      coverImageUrl: p.coverImageUrl,
      imageAltText: p.imageAltText,
      authorFirstName: p.authorFirstName,
      authorLastName: p.authorLastName,
      shortSummary: p.shortSummary,
      categories: p.categories,
      tags: p.tags,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      seoKeywords: p.seoKeywords,
      canonicalUrl: p.canonicalUrl,
      featured: p.featured,
      allowComments: p.allowComments,
      publishAt: p.publishAt,
    });
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
        <BlogEditorForm defaultAuthorName={defaultAuthorName} editingPost={editingPost} onDone={backToList} />
      )}

      {tab === "list" && (
        <>
          <p style={{ color: "var(--ink-soft)", fontSize: 14, marginBottom: 24, maxWidth: 600 }}>
            Posts written on the platform (reading tips, behind-the-scenes notes, and interviews). New posts are
            checked by our support team before they go live.
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
                        <img src={p.coverImageUrl} alt={p.imageAltText || p.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
                      )}
                    </div>
                    <div className="blog-body">
                      <div className="blog-cat">
                        {p.categories.length > 0 && <span>{p.categories.join(" · ")}</span>}
                        {p.featured && <span style={{ color: "var(--coral-deep)" }}> ★ Featured</span>}
                        {p.isMine && <span className={`status-pill ${STATUS_CLASS[p.status]}`} style={{ marginLeft: 6 }}>{STATUS_LABEL[p.status]}</span>}
                      </div>
                      <h3>{p.title}</h3>
                      {p.subtitle && <p style={{ fontSize: 12.5, color: "var(--ink-faint)", margin: "-4px 0 8px" }}>{p.subtitle}</p>}
                      <p>{(p.shortSummary || p.content).slice(0, 160)}{(p.shortSummary || p.content).length > 160 ? "…" : ""}</p>
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
