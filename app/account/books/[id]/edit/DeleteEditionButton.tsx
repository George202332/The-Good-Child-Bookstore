"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEdition } from "@/actions/submissions";

/** "Delete Book" sits to the right of Save / Publish in the same row, in a warning colour. It deletes
 * ONLY that tab's edition, and only after a confirmation step. If it was the last edition, the whole
 * book is removed. `inline` renders just the button (plus its confirmation) so a form can place it in
 * its own button row; otherwise it makes a row of its own. */
export function DeleteEditionButton({
  bookId,
  edition,
  editionLabel,
  otherEditionExists,
  inline = false,
}: {
  bookId: string;
  edition: "digital" | "print";
  editionLabel: string;
  otherEditionExists: boolean;
  inline?: boolean;
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

  const warn: React.CSSProperties = { background: "#B3261E", borderColor: "#B3261E", color: "#fff" };
  const body = (
    <>
      <button type="button" className="btn btn-small" style={warn} disabled={isPending} onClick={() => setConfirming(true)} aria-expanded={confirming}>
        Delete Book
      </button>
      {confirming && (
        <div role="alertdialog" aria-label="Confirm delete" style={{ flexBasis: "100%", display: "flex", flexDirection: "column", gap: 8, maxWidth: 520, padding: 12, border: "1px solid #B3261E", borderRadius: 8, background: "#FDECEA" }}>
          <p style={{ fontSize: 13.5, margin: 0 }}>
            Delete the <strong>{editionLabel}</strong> edition of this book? It is removed from sale, along with its promotions, notifications and files.{" "}
            {otherEditionExists
              ? "The other edition is not touched."
              : "This is the only edition, so the whole book will be removed."}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-small" style={warn} disabled={isPending} onClick={confirm}>
              {isPending ? "Deleting…" : "Yes, Delete"}
            </button>
            <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => { setConfirming(false); setError(""); }}>
              Cancel
            </button>
          </div>
          {error && <span role="alert" style={{ fontSize: 12.5, color: "#6F1A28" }}>{error}</span>}
        </div>
      )}
    </>
  );
  if (inline) return body;
  return <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, borderTop: "1px solid var(--line)", marginTop: 24, paddingTop: 16 }}>{body}</div>;
}
