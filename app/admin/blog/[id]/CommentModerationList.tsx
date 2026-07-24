"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCommentAsModerator } from "@/actions/blog-management";
import type { BlogCommentRow } from "@/actions/blog-management";

export function CommentModerationList({ comments }: { comments: BlogCommentRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (comments.length === 0) {
    return <div style={{ padding: "20px 0", color: "var(--ink-faint, var(--admin-text-faint))", fontSize: 13 }}>No comments yet.</div>;
  }

  return (
    <div className="map-card" style={{ padding: "6px 16px" }}>
      {comments.map((c) => (
        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.commenterName}</div>
            <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>
              {c.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
            <p style={{ fontSize: 13.5 }}>{c.content}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            disabled={isPending}
            onClick={() => {
              if (!confirm("Delete this comment?")) return;
              startTransition(async () => {
                await deleteCommentAsModerator(c.id);
                router.refresh();
              });
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
