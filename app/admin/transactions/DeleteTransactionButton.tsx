"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTransaction } from "@/actions/transactions";

export function DeleteTransactionButton({ id, type, detail }: { id: string; type: "sale" | "payout"; detail: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      const res = await deleteTransaction(id, type);
      if (!res.ok) setError(res.error ?? "Couldn't delete this transaction.");
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
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,20,32,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => !isPending && setOpen(false)}>
          <div className="map-card" style={{ padding: 24, maxWidth: 420, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Delete this transaction?</h3>
            <p style={{ fontSize: 13.5, color: "var(--admin-text-faint, #6B7385)", marginBottom: 16 }}>
              &quot;{detail}&quot; — this permanently removes the transaction, including any royalty or affiliate
              commission share tied to it. It&apos;s removed from every view that reads it, including the author&apos;s own
              Transactions/Revenue page. This cannot be undone.
            </p>
            {error && <p style={{ fontSize: 12.5, color: "var(--admin-danger, #B7472A)", marginBottom: 12 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={handleConfirm}>{isPending ? "Deleting…" : "Confirm delete"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
