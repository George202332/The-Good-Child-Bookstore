"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBookFromCatalog } from "@/actions/book-management";

export function DeleteBookButton({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (confirming) {
    return (
      <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
        <span style={{ display: "inline-flex", gap: 6 }}>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteBookFromCatalog(bookId);
                if (!res.ok) setError(res.error ?? "Couldn't delete this book.");
                else router.refresh();
                setConfirming(false);
              })
            }
          >
            {isPending ? "…" : "Confirm delete"}
          </button>
          <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </span>
        {error && <span style={{ fontSize: 11.5, color: "var(--coral-deep, #B7472A)", maxWidth: 220 }}>{error}</span>}
      </span>
    );
  }

  return (
    <button type="button" className="btn btn-ghost btn-small" onClick={() => { setError(null); setConfirming(true); }}>
      Delete
    </button>
  );
}
