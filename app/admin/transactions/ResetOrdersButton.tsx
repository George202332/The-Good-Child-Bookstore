"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetAllOrders } from "@/actions/transactions";
import { Modal } from "@/components/Modal";

/**
 * A bulk "clear every order" button — the direct replacement for what
 * the old Data Management page's test-data wipe used to cover, scoped
 * specifically to orders/sales since that's the only kind of leftover
 * test data actually reported stale (the "Total orders" card showing a
 * stale count with no real orders behind it). Admin-only, rendered only
 * on this page by the caller.
 */
export function ResetOrdersButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ orders: number; saleLines: number } | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      const res = await resetAllOrders();
      if (!res.ok) {
        setError(res.error ?? "Couldn't reset order data.");
        return;
      }
      setOpen(false);
      setError(null);
      setDone(res.deleted ?? null);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-small" onClick={() => { setError(null); setOpen(true); }}>
        Reset all orders
      </button>
      {done && (
        <p className="field-hint" style={{ color: "#1F6B48", marginTop: 6 }}>
          Cleared {done.orders} order(s) and {done.saleLines} sale line(s).
        </p>
      )}
      {open && (
        <Modal onClose={() => !isPending && setOpen(false)} maxWidth={440}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Permanently delete every order?</h3>
            <p style={{ fontSize: 13.5, color: "var(--admin-text-faint, #6B7385)", marginBottom: 16 }}>
              This deletes <strong>every order</strong> on the platform — real or test — along with every sale line,
              payment log, and invoice tied to them. Revenue, royalty, and commission totals across the dashboard,
              analytics, and every author&apos;s own account all recompute from what&apos;s left, which after this is
              nothing. This cannot be undone.
            </p>
            {error && <p style={{ fontSize: 12.5, color: "var(--admin-danger, #B7472A)", marginBottom: 12 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={handleConfirm}>
                {isPending ? "Deleting…" : "Yes, delete every order"}
              </button>
            </div>
        </Modal>
      )}
    </>
  );
}
