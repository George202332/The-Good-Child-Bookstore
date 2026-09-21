"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllExistingDataAsTest, deleteAllTestData, type TestDataSummary } from "@/actions/test-data";

export function TestDataControls({ summary }: { summary: TestDataSummary }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmingMark, setConfirmingMark] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleMark() {
    startTransition(async () => {
      const res = await markAllExistingDataAsTest();
      setConfirmingMark(false);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        setMessage("Every existing account, book, and order has been marked as test data.");
        setError(null);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteAllTestData();
      setConfirmingDelete(false);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        setMessage(`Deleted ${res.deleted?.accounts ?? 0} account(s), ${res.deleted?.books ?? 0} book(s), and ${res.deleted?.orders ?? 0} order(s) marked as test data.`);
        setError(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="map-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: 15, marginBottom: 10 }}>Test data tools</h3>
      <p className="field-hint" style={{ margin: "0 0 16px" }}>
        Step 1: mark everything that currently exists as test data (a safe, reversible flag — nothing is deleted
        yet). Step 2: once you&apos;ve confirmed that looks right, permanently delete everything marked as test.
        Anything created after step 1 — new signups, new books, new orders — is untouched and treated as real/live
        automatically.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setConfirmingMark(true)}>
          Mark all existing data as test
        </button>
        <button type="button" className="btn btn-primary btn-small" disabled={isPending || summary.testAccounts + summary.testBooks + summary.testOrders === 0} onClick={() => setConfirmingDelete(true)}>
          Permanently delete all test data
        </button>
      </div>

      {message && <p style={{ fontSize: 12.5, color: "#1F6B48", marginBottom: 8 }}>{message}</p>}
      {error && <p style={{ fontSize: 12.5, color: "var(--admin-danger, #B7472A)", marginBottom: 8 }}>{error}</p>}

      {confirmingMark && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,20,32,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => !isPending && setConfirmingMark(false)}>
          <div className="map-card" style={{ padding: 24, maxWidth: 420, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Mark everything as test data?</h3>
            <p style={{ fontSize: 13.5, color: "var(--admin-text-faint, #6B7385)", marginBottom: 16 }}>
              This flags every account, book, and order that exists right now. It does not delete anything —
              you&apos;ll get a chance to review the numbers before anything is actually removed.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setConfirmingMark(false)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={handleMark}>{isPending ? "Marking…" : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}

      {confirmingDelete && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,20,32,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => !isPending && setConfirmingDelete(false)}>
          <div className="map-card" style={{ padding: 24, maxWidth: 420, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Permanently delete all test data?</h3>
            <p style={{ fontSize: 13.5, color: "var(--admin-text-faint, #6B7385)", marginBottom: 10 }}>
              This will permanently delete <strong>{summary.testAccounts}</strong> account(s), <strong>{summary.testBooks}</strong> book(s),
              and <strong>{summary.testOrders}</strong> order(s) currently flagged as test data — including everything
              connected to them (submissions, reviews, payout history, etc). This cannot be undone.
            </p>
            <p style={{ fontSize: 13.5, color: "var(--admin-text-faint, #6B7385)", marginBottom: 16 }}>
              Your <strong>{summary.liveAccounts}</strong> live account(s), <strong>{summary.liveBooks}</strong> live book(s), and{" "}
              <strong>{summary.liveOrders}</strong> live order(s) are not affected.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setConfirmingDelete(false)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={handleDelete}>{isPending ? "Deleting…" : "Yes, permanently delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
