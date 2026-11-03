"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveExpense, deleteExpense } from "@/actions/accounting";
import type { ExpenseRow } from "@/lib/accounting/calc";
import { EXPENSE_CATEGORIES } from "@/lib/accounting/expense-input";
import { TH_STYLE, TD_STYLE } from "@/components/admin-table";
import { usd, shortDateTime } from "@/lib/accounting/format";

/**
 * Expenses: everyone who can open Accounting can READ this list; only an Admin sees the add / edit / delete controls
 * (and the server refuses those actions for anyone else regardless of what the page shows).
 */
export function ExpensesSection({ expenses, readOnly, locked, selection, includeTest }: { expenses: ExpenseRow[]; readOnly: boolean; locked: boolean; selection: string; includeTest: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  const q = `selection=${encodeURIComponent(selection)}&includeTest=${includeTest ? 1 : 0}`;
  const canWrite = !readOnly && !locked;

  const submit = (fd: FormData) =>
    start(async () => {
      const res = await saveExpense(fd);
      setMsg({ ok: res.ok, text: res.ok ? res.message ?? "Saved." : res.error ?? "Could not save." });
      if (res.ok) {
        setEditing(null);
        formRef.current?.reset();
        router.refresh();
      }
    });

  const remove = (e: ExpenseRow) => {
    if (!window.confirm(`Delete this expense?\n\n${e.category}: ${e.description} (${usd(e.amount)})\n\nThe deletion is recorded in the change log.`)) return;
    start(async () => {
      const res = await deleteExpense(e.id);
      setMsg({ ok: res.ok, text: res.ok ? res.message ?? "Deleted." : res.error ?? "Could not delete." });
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className="map-card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <h3 style={{ fontSize: 15 }}>Expenses</h3>
        {!readOnly && (
          <div style={{ display: "flex", gap: 8 }}>
            <a className="btn btn-ghost btn-small" href={`/api/accounting/export?table=expenses&${q}&format=csv`}>CSV</a>
            <a className="btn btn-ghost btn-small" href={`/api/accounting/export?table=expenses&${q}&format=pdf`}>PDF</a>
          </div>
        )}
      </div>
      {readOnly && <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 6 }}>View only. Only an Admin can add, change or delete expenses.</p>}
      {!readOnly && locked && <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 6 }}>This month is closed, so its expenses are locked. Reopen the month to change them.</p>}

      {canWrite && (
        <form
          key={editing?.id ?? "new"}
          ref={formRef}
          action={submit}
          style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginTop: 12, alignItems: "end" }}
        >
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <label style={{ fontSize: 12 }}>Date<br /><input type="date" name="date" required defaultValue={editing?.date ?? today} /></label>
          <label style={{ fontSize: 12 }}>Category<br />
            <input name="category" list="expense-categories" required maxLength={60} defaultValue={editing?.category ?? ""} placeholder="Choose or type" />
            <datalist id="expense-categories">{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label style={{ fontSize: 12 }}>Description<br /><input name="description" required minLength={2} maxLength={300} defaultValue={editing?.description ?? ""} /></label>
          <label style={{ fontSize: 12 }}>Amount (USD)<br /><input name="amount" required inputMode="decimal" placeholder="0.00" defaultValue={editing ? editing.amount.toFixed(2) : ""} /></label>
          <label style={{ fontSize: 12 }}>Receipt or invoice (PDF, JPG, PNG, WebP, up to 4 MB)<br /><input type="file" name="receipt" accept="application/pdf,image/jpeg,image/png,image/webp" /></label>
          {editing?.receiptName && (
            <label style={{ fontSize: 12 }}><input type="checkbox" name="removeReceipt" value="1" /> Remove the current receipt ({editing.receiptName})</label>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary btn-small" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Add expense"}</button>
            {editing && <button type="button" className="btn btn-ghost btn-small" onClick={() => setEditing(null)}>Cancel</button>}
          </div>
        </form>
      )}
      {msg && <p role="status" style={{ marginTop: 8, fontSize: 13, color: msg.ok ? "var(--admin-success)" : "var(--admin-danger)" }}>{msg.text}</p>}

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={TH_STYLE}>Date</th><th style={TH_STYLE}>Category</th><th style={TH_STYLE}>Description</th>
              <th style={{ ...TH_STYLE, textAlign: "right" }}>Amount</th><th style={TH_STYLE}>Entered by</th><th style={TH_STYLE}>Receipt</th>
              {canWrite && <th style={TH_STYLE}></th>}
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && <tr><td style={TD_STYLE} colSpan={canWrite ? 7 : 6}>No expenses entered for this period.</td></tr>}
            {expenses.map((e) => (
              <tr key={e.id}>
                <td style={TD_STYLE}>{e.date}</td>
                <td style={TD_STYLE}>{e.category}</td>
                <td style={TD_STYLE}>{e.description}</td>
                <td style={{ ...TD_STYLE, textAlign: "right" }}>{usd(e.amount)}</td>
                <td style={TD_STYLE}>
                  {e.enteredByName}
                  <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{e.enteredAt ? shortDateTime(e.enteredAt) : ""}</div>
                  {e.updatedAt && <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>Edited by {e.updatedByName} {shortDateTime(e.updatedAt)}</div>}
                </td>
                <td style={TD_STYLE}>{e.receiptFileId ? <a href={`/api/accounting/receipt/${e.receiptFileId}`} target="_blank" rel="noopener noreferrer">{e.receiptName ?? "Open"}</a> : <span style={{ color: "var(--ink-faint)" }}>None</span>}</td>
                {canWrite && (
                  <td style={{ ...TD_STYLE, whiteSpace: "nowrap" }}>
                    <button type="button" className="btn btn-ghost btn-small" disabled={pending} onClick={() => { setEditing(e); setMsg(null); }}>Edit</button>{" "}
                    <button type="button" className="btn btn-ghost btn-small" disabled={pending} onClick={() => remove(e)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
