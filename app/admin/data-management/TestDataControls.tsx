"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markAllExistingDataAsTest,
  deleteAllTestData,
  listAccountsAffectedByMarkAsTest,
  listAccountsAffectedByDelete,
  type TestDataSummary,
  type AffectedAccount,
} from "@/actions/test-data";

export function TestDataControls({ summary }: { summary: TestDataSummary }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [markModal, setMarkModal] = useState<AffectedAccount[] | null>(null);
  const [deleteModal, setDeleteModal] = useState<AffectedAccount[] | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openMarkModal() {
    setLoadingList(true);
    const res = await listAccountsAffectedByMarkAsTest();
    setLoadingList(false);
    if ("error" in res) setError(res.error);
    else setMarkModal(res);
  }

  async function openDeleteModal() {
    setLoadingList(true);
    const res = await listAccountsAffectedByDelete();
    setLoadingList(false);
    if ("error" in res) setError(res.error);
    else setDeleteModal(res);
  }

  function handleMark() {
    startTransition(async () => {
      const res = await markAllExistingDataAsTest();
      setMarkModal(null);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        setMessage("Every existing Reader and Author account, plus all books and orders, has been marked as test data. Backend staff accounts (Admin/Editor/Accountant) are never touched by this tool.");
        setError(null);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteAllTestData();
      setDeleteModal(null);
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
      <p className="field-hint" style={{ margin: "0 0 10px" }}>
        Step 1: mark everything that currently exists as test data (a safe, reversible flag — nothing is deleted
        yet). Step 2: once you&apos;ve reviewed the actual list of accounts and confirmed that looks right,
        permanently delete everything marked as test.
      </p>
      <p className="field-hint" style={{ margin: "0 0 16px", fontWeight: 700 }}>
        Backend staff accounts (Admin, Editor, Accountant) are never marked or deleted by this tool, under any
        circumstances — only Reader and Author accounts can be affected.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-ghost btn-small" disabled={isPending || loadingList} onClick={openMarkModal}>
          {loadingList ? "Loading…" : "Mark all existing data as test"}
        </button>
        <button type="button" className="btn btn-primary btn-small" disabled={isPending || loadingList || summary.testAccounts + summary.testBooks + summary.testOrders === 0} onClick={openDeleteModal}>
          Permanently delete all test data
        </button>
      </div>

      {message && <p style={{ fontSize: 12.5, color: "#1F6B48", marginBottom: 8 }}>{message}</p>}
      {error && <p style={{ fontSize: 12.5, color: "var(--admin-danger, #B7472A)", marginBottom: 8 }}>{error}</p>}

      {markModal && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,20,32,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => !isPending && setMarkModal(null)}>
          <div className="map-card" style={{ padding: 24, maxWidth: 520, width: "100%", maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Mark {markModal.length} account(s) as test data?</h3>
            <p style={{ fontSize: 13.5, color: "var(--admin-text-faint, #6B7385)", marginBottom: 14 }}>
              Review this list carefully. This does not delete anything yet — but make sure none of these are
              accounts you actually use.
            </p>
            <div style={{ border: "1px solid var(--admin-border, #2A3244)", borderRadius: 8, marginBottom: 16 }}>
              {markModal.length === 0 ? (
                <p style={{ padding: 14, fontSize: 13, color: "var(--admin-text-faint, #6B7385)" }}>No Reader or Author accounts to mark.</p>
              ) : (
                markModal.map((a) => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--admin-border, #2A3244)", fontSize: 12.5 }}>
                    <span>{a.email} <span style={{ color: "var(--admin-text-faint, #6B7385)" }}>({a.role})</span></span>
                    {a.isCurrentUser && <span style={{ fontWeight: 700, color: "var(--admin-danger, #B7472A)" }}>← you are signed in as this</span>}
                  </div>
                ))
              )}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setMarkModal(null)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-small" disabled={isPending || markModal.length === 0} onClick={handleMark}>{isPending ? "Marking…" : "Confirm"}</button>
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
              marked as test, plus everything connected to these accounts. This cannot be undone.
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
