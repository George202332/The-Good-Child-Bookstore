"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTransaction } from "@/actions/transactions";
import { Modal } from "@/components/Modal";

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
        <Modal onClose={() => !isPending && setOpen(false)} maxWidth={420}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Delete this transaction?</h3>
            <p style={{ fontSize: 13.5, color: "var(--admin-text-faint, #6B7385)", marginBottom: 16 }}>
              &quot;{detail}&quot; — this permanently removes the transaction, including any royalty or affiliate
              commission share tied to it. It&apos;s removed from every view that reads it, including the author&apos;s own
              Transactions/Revenue page. This cannot be undone.
            </p>
            {error && <p style={{ fontSize: 12.5, color: "var(--admin-danger, #8C2F16)", marginBottom: 12 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={handleConfirm}>{isPending ? "Deleting…" : "Confirm delete"}</button>
            </div>
        </Modal>
      )}
    </>
  );
}
