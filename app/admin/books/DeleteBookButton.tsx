"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBookFromCatalog } from "@/actions/book-management";

export function DeleteBookButton({ bookId, bookTitle }: { bookId: string; bookTitle: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      const res = await deleteBookFromCatalog(bookId);
      if (!res.ok) setError(res.error ?? "Couldn't delete this book.");
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-small" onClick={() => { setError(null); setOpen(true); }}>
        Delete
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,20,32,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => !isPending && setOpen(false)}
        >
          <div
            className="map-card"
            style={{ padding: 24, maxWidth: 380, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Delete &quot;{bookTitle}&quot;?</h3>
            <p style={{ fontSize: 13.5, color: "var(--admin-text-faint, #6B7385)", marginBottom: 16 }}>
              This permanently removes the book from the catalog. This can&apos;t be undone.
            </p>
            {error && <p style={{ fontSize: 12.5, color: "var(--coral-deep, #B7472A)", marginBottom: 12 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={handleConfirm}>
                {isPending ? "Deleting…" : "Confirm delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
