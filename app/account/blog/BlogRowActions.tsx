"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { withdrawMyBlog, deleteMyBlog } from "@/actions/blog-author";
import { canEdit, canWithdraw, canDelete, deleteConfirmMessage, WITHDRAW_CONFIRM } from "@/lib/blog-status";

/** Edit / Withdraw / Delete for one row of the My Blogs table, with its own
 * pending state and inline error. Edit only applies to Draft / Rejected posts
 * (the rule updateBlogPost enforces); Withdraw is hidden unless the post is
 * Published or Pending Review. */
export function BlogRowActions({ blogId, status, onEdit }: { blogId: string; status: string; onEdit: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string) => Promise<{ ok: boolean; error?: string }>, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setError(null);
    startTransition(async () => {
      const res = await action(blogId);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      router.refresh();
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
        {canEdit(status) ? (
          <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={onEdit}>Edit</button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            disabled
            title="Withdraw this blog first to edit it."
          >
            Edit
          </button>
        )}
        {canWithdraw(status) && (
          <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => run(withdrawMyBlog, WITHDRAW_CONFIRM)}>
            {isPending ? "Working…" : "Withdraw"}
          </button>
        )}
        {canDelete(status) && (
          <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => run(deleteMyBlog, deleteConfirmMessage(status))}>
            {isPending && !canWithdraw(status) ? "Deleting…" : "Delete"}
          </button>
        )}
      </div>
      {error && <div role="alert" style={{ fontSize: 12, color: "#6F1A28", marginTop: 4, maxWidth: 220 }}>{error}</div>}
    </div>
  );
}
