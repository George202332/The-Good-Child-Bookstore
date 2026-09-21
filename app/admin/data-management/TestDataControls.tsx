"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markAllExistingDataAsTest,
  deleteAllTestData,
  applyDetectedTestDataFlags,
  listAccountsAffectedByDelete,
  type TestDataSummary,
  type AffectedAccount,
} from "@/actions/test-data";
import { generateTestDataReport, type TestDataReport } from "@/actions/test-data-detection";

function ReasonList({ items }: { items: { id: string; label: string; reasons: string[] }[] }) {
  if (items.length === 0) return <p style={{ padding: 12, fontSize: 12.5, color: "var(--admin-text-faint, #6B7385)" }}>None detected.</p>;
  return (
    <div>
      {items.map((it) => (
        <div key={it.id} style={{ padding: "8px 12px", borderBottom: "1px solid var(--admin-border, #2A3244)" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{it.label}</div>
          <ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>
            {it.reasons.map((r, i) => (
              <li key={i} style={{ fontSize: 11.5, color: "var(--admin-text-faint, #6B7385)" }}>{r}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function TestDataControls({ summary }: { summary: TestDataSummary }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<TestDataReport | null>(null);
  const [confirmingApply, setConfirmingApply] = useState(false);
  const [deleteModal, setDeleteModal] = useState<AffectedAccount[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runPreview() {
    setLoading(true);
    setError(null);
    const res = await generateTestDataReport();
    setLoading(false);
    if ("error" in res) setError(res.error);
    else setReport(res);
  }

  function handleApply() {
    if (!report) return;
    startTransition(async () => {
      const res = await applyDetectedTestDataFlags(
        report.users.map((u) => u.id),
        report.books.map((b) => b.id),
        report.orders.map((o) => o.id)
      );
      setConfirmingApply(false);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        setMessage("The detected records above have been flagged as test data. Nothing was deleted yet.");
        setReport(null);
        router.refresh();
      }
    });
  }

  async function openDeleteModal() {
    setLoading(true);
    const res = await listAccountsAffectedByDelete();
    setLoading(false);
    if ("error" in res) setError(res.error);
    else setDeleteModal(res);
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteAllTestData();
      setDeleteModal(null);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        setMessage(`Deleted ${res.deleted?.accounts ?? 0} account(s), ${res.deleted?.books ?? 0} book(s), and ${res.deleted?.orders ?? 0} order(s) marked as test data. An audit log entry was recorded.`);
        setError(null);
        router.refresh();
      }
    });
  }

  // Kept as a fallback for the "no real customers yet, everything is
  // test" situation — but the evidence-based Preview above is the
  // primary, recommended path now.
  function handleMarkAllLegacy() {
    startTransition(async () => {
      const res = await markAllExistingDataAsTest();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        setMessage("Every existing Reader/Author account, book, and order has been marked as test data.");
        router.refresh();
      }
    });
  }

  return (
    <div className="map-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: 15, marginBottom: 10 }}>Test data tools</h3>
      <p className="field-hint" style={{ margin: "0 0 10px" }}>
        <strong>Preview Test Data</strong> scans for real evidence (test email patterns, Paystack test-card
        payments, existing flags) and shows exactly what it found and why — nothing is changed yet. Review it,
        then apply the flags, then delete. Backend staff accounts are never eligible, and an order is never
        flagged unless it actually matches a real test signal — anything without one, including any real
        Paystack transaction, is left completely alone.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary btn-small" disabled={isPending || loading} onClick={runPreview}>
          {loading ? "Scanning…" : "Preview Test Data"}
        </button>
        <button type="button" className="btn btn-ghost btn-small" disabled={isPending || loading} onClick={openDeleteModal}>
          Delete All Test Data
        </button>
      </div>

      {message && <p style={{ fontSize: 12.5, color: "#1F6B48", marginBottom: 8 }}>{message}</p>}
      {error && <p style={{ fontSize: 12.5, color: "var(--admin-danger, #B7472A)", marginBottom: 8 }}>{error}</p>}

      {report && (
        <div className="map-card" style={{ padding: 16, marginBottom: 16 }}>
          <h4 style={{ fontSize: 13.5, marginBottom: 10 }}>
            Detected: {report.users.length} account(s), {report.books.length} book(s), {report.orders.length} order(s),{" "}
            {report.paymentLogs.length} payment log(s), {report.affiliateLinks.length} affiliate link(s), {report.saleLines.length} sale line(s)
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", color: "var(--admin-text-faint, #6B7385)", marginBottom: 4 }}>Accounts</div>
              <div style={{ border: "1px solid var(--admin-border, #2A3244)", borderRadius: 8, maxHeight: 200, overflowY: "auto" }}><ReasonList items={report.users} /></div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", color: "var(--admin-text-faint, #6B7385)", marginBottom: 4 }}>Books</div>
              <div style={{ border: "1px solid var(--admin-border, #2A3244)", borderRadius: 8, maxHeight: 200, overflowY: "auto" }}><ReasonList items={report.books} /></div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", color: "var(--admin-text-faint, #6B7385)", marginBottom: 4 }}>Orders</div>
              <div style={{ border: "1px solid var(--admin-border, #2A3244)", borderRadius: 8, maxHeight: 200, overflowY: "auto" }}><ReasonList items={report.orders} /></div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", color: "var(--admin-text-faint, #6B7385)", marginBottom: 4 }}>Payment logs</div>
              <div style={{ border: "1px solid var(--admin-border, #2A3244)", borderRadius: 8, maxHeight: 200, overflowY: "auto" }}><ReasonList items={report.paymentLogs} /></div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-primary btn-small" disabled={isPending || (report.users.length + report.books.length + report.orders.length === 0)} onClick={() => setConfirmingApply(true)}>
              Flag these as test data
            </button>
            <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setReport(null)}>Dismiss</button>
          </div>
        </div>
      )}

      <details style={{ marginTop: 8 }}>
        <summary style={{ fontSize: 12, color: "var(--admin-text-faint, #6B7385)", cursor: "pointer" }}>
          Legacy option: mark everything as test (no evidence check)
        </summary>
        <p className="field-hint" style={{ margin: "8px 0" }}>
          Only use this if you&apos;re certain literally everything in the database right now is test data with no
          exceptions — it skips the evidence check above.
        </p>
        <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={handleMarkAllLegacy}>
          Mark all existing accounts/books/orders as test
        </button>
      </details>

      {confirmingApply && report && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,20,32,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => !isPending && setConfirmingApply(false)}>
          <div className="map-card" style={{ padding: 24, maxWidth: 420, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Flag the detected records as test data?</h3>
            <p style={{ fontSize: 13.5, color: "var(--admin-text-faint, #6B7385)", marginBottom: 16 }}>
              This flags {report.users.length} account(s), {report.books.length} book(s), and {report.orders.length} order(s) — the exact
              set shown above. This does not delete anything yet.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setConfirmingApply(false)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={handleApply}>{isPending ? "Flagging…" : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,20,32,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => !isPending && setDeleteModal(null)}>
          <div className="map-card" style={{ padding: 24, maxWidth: 520, width: "100%", maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Permanently delete {deleteModal.length} account(s)?</h3>
            <p style={{ fontSize: 13.5, color: "var(--admin-text-faint, #6B7385)", marginBottom: 10 }}>
              This also deletes <strong>{summary.testBooks}</strong> book(s) and <strong>{summary.testOrders}</strong> order(s)
              marked as test, plus everything connected to these accounts. This cannot be undone. An audit log entry will
              be recorded.
            </p>
            <div style={{ border: "1px solid var(--admin-border, #2A3244)", borderRadius: 8, marginBottom: 16 }}>
              {deleteModal.length === 0 ? (
                <p style={{ padding: 14, fontSize: 13, color: "var(--admin-text-faint, #6B7385)" }}>No accounts marked as test.</p>
              ) : (
                deleteModal.map((a) => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--admin-border, #2A3244)", fontSize: 12.5 }}>
                    <span>{a.email} <span style={{ color: "var(--admin-text-faint, #6B7385)" }}>({a.role})</span></span>
                    {a.isCurrentUser && <span style={{ fontWeight: 700, color: "var(--admin-danger, #B7472A)" }}>← you are signed in as this</span>}
                  </div>
                ))
              )}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setDeleteModal(null)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={handleDelete}>{isPending ? "Deleting…" : "Yes, permanently delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
