"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBook } from "@/actions/submissions";

export function DeleteButton({ bookId, title }: { bookId: string; title: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  if (confirming) {
    return (
      <span style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, color: "var(--ink-soft)", maxWidth: 200 }}>
          Delete &ldquo;{title}&rdquo;? It will be removed from sale and from your list.
        </span>
        <span style={{ display: "inline-flex", gap: 6 }}>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const r = await deleteBook(bookId);
                if (!r.ok) { setError(r.error ?? "Couldn't delete this book."); return; }
                setConfirming(false);
                router.refresh();
              })
            }
          >
            {isPending ? "…" : "Yes, delete"}
          </button>
          <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => { setConfirming(false); setError(""); }}>
            Cancel
          </button>
        </span>
        {error && <span role="alert" style={{ fontSize: 12, color: "#6F1A28" }}>{error}</span>}
      </span>
    );
  }

  return (
    <button type="button" className="btn btn-ghost btn-small" onClick={() => setConfirming(true)}>
      Delete
    </button>
  );
}
