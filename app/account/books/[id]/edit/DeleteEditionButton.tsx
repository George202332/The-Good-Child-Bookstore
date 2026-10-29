"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEdition } from "@/actions/submissions";

/** "Delete book" at the bottom of an edit tab. It deletes ONLY that tab's edition, after a
 * confirmation step. If it was the last edition, the whole book is removed. */
export function DeleteEditionButton({
  bookId,
  edition,
  editionLabel,
  otherEditionExists,
}: {
  bookId: string;
  edition: "digital" | "print";
  editionLabel: string;
  otherEditionExists: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  function confirm() {
    startTransition(async () => {
      const r = await deleteEdition(bookId, edition);
      if (!r.ok) {
        setError(r.error ?? "Couldn't delete this edition.");
        return;
      }
      router.push(r.remainingBookId ? `/account/books/${r.remainingBookId}/edit` : "/account/books");
      router.refresh();
    });
  }

  return (
    <div style={{ borderTop: "1px solid var(--line)", marginTop: 24, paddingTop: 16 }}>
      {confirming ? (
        <div role="alertdialog" aria-label="Confirm delete" style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 520 }}>
          <p style={{ fontSize: 13.5, margin: 0 }}>
            Delete the <strong>{editionLabel}</strong> edition of this book? It is removed from sale, along with its promotions, notifications and files.{" "}
            {otherEditionExists
              ? "The other edition is not touched."
              : "This is the only edition, so the whole book will be removed."}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={confirm}>
              {isPending ? "Deleting…" : "Yes, delete"}
            </button>
            <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => { setConfirming(false); setError(""); }}>
              Cancel
            </button>
          </div>
          {error && <span role="alert" style={{ fontSize: 12.5, color: "#6F1A28" }}>{error}</span>}
        </div>
      ) : (
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setConfirming(true)}>
          Delete book
        </button>
      )}
    </div>
  );
}
