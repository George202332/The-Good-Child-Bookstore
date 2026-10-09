"use client";

import { useState } from "react";
import Link from "next/link";
import { BlogEditorForm, type EditingBlogPost } from "./BlogEditorForm";
import { ColHelp } from "@/components/ColHelp";
import { TH_STYLE, TD_STYLE } from "@/components/admin-table";
import { BlogRowActions } from "./BlogRowActions";
import { blogStatusLabel, blogStatusPillClass, blogSummaryLine, countBlogs, blogDateInfo, type BlogStatus } from "@/lib/blog-status";

const TABLE_HEAD_STYLE: React.CSSProperties = { ...TH_STYLE, padding: "12px 16px", fontSize: 11, letterSpacing: undefined };
const TABLE_CELL_STYLE: React.CSSProperties = { ...TD_STYLE, padding: "10px 16px", fontSize: undefined, verticalAlign: undefined };

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

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
  status: BlogStatus;
  revisionNotes: string | null;
  createdAt: string;
  publishAt: string | null;
  authorName: string;
  commentCount: number;
}

/** Landing state is always the list. "Submit a new blog" sits top-left
 * as its own tab, and Edit on one of the writer's own draft/rejected
 * posts switches to that tab pre-filled with every field. Open to every
 * account type (Reader, Author, Affiliate) — the parent page passes
 * defaultAuthorName from whoever is signed in. */
export function BlogPageTabs({ posts, defaultAuthorName }: { posts: BlogListItem[]; defaultAuthorName: string }) {
  const [tab, setTab] = useState<"list" | "submit">("list");
  const [editingPost, setEditingPost] = useState<EditingBlogPost | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);

  function startNewPost() {
    setNotice(null);
    setEditingPost(undefined);
    setTab("submit");
  }

  function startEditingPost(p: BlogListItem) {
    setNotice(null);
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

  function backToList(result?: { submittedForReview: boolean }) {
    setEditingPost(undefined);
    setTab("list");
    if (result) {
      setNotice(result.submittedForReview ? "Your blog was submitted and is pending review." : "Your draft was saved.");
    }
  }

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15.5 }}>My Blogs</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Write a new post, or manage your existing ones.</p>
        </div>
        <button type="button" className="btn btn-primary btn-small" onClick={startNewPost}>
          Submit a new blog
        </button>
      </div>
      {tab === "submit" && (
        <button type="button" className="btn btn-ghost btn-small" style={{ marginBottom: 14 }} onClick={() => backToList()}>
          ← Back to posts
        </button>
      )}

      {tab === "submit" && (
        <BlogEditorForm defaultAuthorName={defaultAuthorName} editingPost={editingPost} onDone={backToList} />
      )}

      {tab === "list" && (
        <>
          {notice && (
            <div role="status" className="field-hint" style={{ marginBottom: 14 }}>{notice}</div>
          )}
          {posts.length === 0 ? (
            <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
              You haven&apos;t written any blogs yet.{" "}
              <button type="button" className="btn btn-ghost btn-small" onClick={startNewPost}>Write your first blog</button>
            </div>
          ) : (
            <>
              <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginBottom: 12 }}>{blogSummaryLine(countBlogs(posts.map((p) => p.status)))}</p>
              <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={TABLE_HEAD_STYLE}>Date<ColHelp text="The date a post went live. Posts that are not published yet show a dash and the date you submitted them." /></th>
                      <th style={TABLE_HEAD_STYLE}>Author<ColHelp text="The byline shown on the post." /></th>
                      <th style={TABLE_HEAD_STYLE}>Title<ColHelp text="The post title. It links to the public post once it is published." /></th>
                      <th style={TABLE_HEAD_STYLE}>Comments<ColHelp text="Number of reader comments on this post." /></th>
                      <th style={TABLE_HEAD_STYLE}>Status<ColHelp text="Draft: not submitted. Pending Review: awaiting our team. Published: live. Rejected: sent back with changes requested." /></th>
                      <th style={TABLE_HEAD_STYLE}>Actions<ColHelp text="Edit works on drafts and rejected posts. Withdraw returns a published or pending post to Draft. Delete removes the post permanently." /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((p) => {
                      const info = blogDateInfo(p.status, p.publishAt ? new Date(p.publishAt) : null, new Date(p.createdAt));
                      const live = p.status === "PUBLISHED" && info.primary === "published";
                      return (
                        <tr key={p.id}>
                          <td style={{ ...TABLE_CELL_STYLE, whiteSpace: "nowrap" }}>
                            {info.date ? (
                              <>
                                <div>{formatDate(info.date)}</div>
                                {info.primary === "scheduled" && <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>Scheduled</div>}
                              </>
                            ) : (
                              <>
                                <div>—</div>
                                <div style={{ fontSize: 12, color: "var(--ink-faint)" }} title="Date you submitted this post">Submitted {formatDate(info.submitted)}</div>
                              </>
                            )}
                          </td>
                          <td style={TABLE_CELL_STYLE}>{p.authorName}</td>
                          <td style={TABLE_CELL_STYLE}>
                            {live ? <Link href={`/blog/${p.slug}`}>{p.title}</Link> : <span>{p.title}</span>}
                            {p.status === "REJECTED" && p.revisionNotes && (
                              <div style={{ fontSize: 12, color: "#6F1A28", marginTop: 4, maxWidth: 260 }}>&quot;{p.revisionNotes}&quot;</div>
                            )}
                          </td>
                          <td style={TABLE_CELL_STYLE}>{p.commentCount}</td>
                          <td style={TABLE_CELL_STYLE}><span className={`status-pill ${blogStatusPillClass(p.status)}`}>{blogStatusLabel(p.status)}</span></td>
                          <td style={TABLE_CELL_STYLE}><BlogRowActions blogId={p.id} status={p.status} onEdit={() => startEditingPost(p)} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
