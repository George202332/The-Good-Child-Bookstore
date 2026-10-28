"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminDeleteBlog } from "@/actions/blog-management";
import { Modal } from "@/components/Modal";

/**
 * Admin-only "Delete" for a blog post, with a confirmation step. The real
 * permission check is on the server (adminDeleteBlog); this button is only
 * shown to admins so nobody else is offered it.
 */
export function DeleteBlogButton({ blogId, title, redirectTo }: { blogId: string; title: string; redirectTo?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const res = await adminDeleteBlog(blogId);
      if (!res.ok) {
        setError(res.error ?? "Could not delete this post.");
        return;
      }
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-small" style={{ color: "var(--coral-deep, #c0392b)" }} onClick={() => { setError(null); setOpen(true); }}>
        Delete
      </button>
      {open && (
        <Modal onClose={() => (isPending ? undefined : setOpen(false))} maxWidth={440}>
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>Delete this blog post?</h3>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 8 }}>
            <strong>&ldquo;{title}&rdquo;</strong> will be permanently deleted, together with its comments, notifications and uploaded pictures.
          </p>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 14, color: "var(--coral-deep, #c0392b)" }}>
            This cannot be undone.
          </p>
          {error && <p role="alert" style={{ fontSize: 13, color: "var(--coral-deep, #c0392b)", marginBottom: 10 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={confirmDelete}>
              {isPending ? "Deleting…" : "Confirm delete"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
