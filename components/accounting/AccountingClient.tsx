"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveTestData, closeMonth, reopenMonth, restoreTestData, resendReport } from "@/actions/accounting";
import type { AccountingView } from "@/lib/accounting/service";
import type { Metric } from "@/lib/accounting/calc";
import { FORMULA_STEPS } from "@/lib/accounting/calc";
import { barChartScene, pieChartScene, PALETTE } from "@/lib/accounting/charts";
import { monthLabel } from "@/lib/accounting/period";
import { usd, usdCents, shortDate, shortDateTime } from "@/lib/accounting/format";
import { Chart3D } from "@/components/accounting/Chart3D";
import { DrillModal } from "@/components/accounting/DrillModal";
import { ExpensesSection } from "@/components/accounting/ExpensesSection";
import { TH_STYLE, TD_STYLE } from "@/components/admin-table";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function Card({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="map-card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ fontSize: 15 }}>{title}</h3>
        {actions}
      </div>
      {children}
    </div>
  );
}

function ExportLinks({ table, selection, includeTest, show }: { table: string; selection: string; includeTest: boolean; show: boolean }) {
  if (!show) return null; // only an Admin can download; an investor can only view
  const q = `table=${table}&selection=${encodeURIComponent(selection)}&includeTest=${includeTest ? 1 : 0}`;
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <a className="btn btn-ghost btn-small" href={`/api/accounting/export?${q}&format=csv`}>CSV</a>
      <a className="btn btn-ghost btn-small" href={`/api/accounting/export?${q}&format=pdf`}>PDF</a>
    </div>
  );
}

export function AccountingClient({ view, readOnly, base }: { view: AccountingView; readOnly: boolean; base: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [drill, setDrill] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");
  const f = view.figures;
  const isMonth = view.selection !== "lifetime";
  const isClosed = view.state?.status === "CLOSED";
  const selYear = isMonth ? Number(view.selection.slice(0, 4)) : null;
  const isClosedLocked = view.locked;
  const reportYear = selYear ?? Number(view.currentMonthKey.slice(0, 4));
  const dlQ = `includeTest=${view.includeTest ? 1 : 0}`;

  const go = (selection: string, test = view.includeTest) => router.push(`${base}?month=${selection}&test=${test ? 1 : 0}`);

  // Figures and charts follow new orders and expenses: the page quietly reloads its numbers every minute while it is on screen.
  useEffect(() => {
    if (isClosedLocked || drill !== null) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 60_000);
    return () => clearInterval(t);
  }, [router, isClosedLocked, drill]);
  const monthsOfYear = useMemo(() => view.months.filter((m) => selYear !== null && m.monthKey.startsWith(String(selYear))), [view.months, selYear]);

  const click = (metric: Metric) => setDrill(metric);
  const amt = (cents: number, metric: Metric, bold?: boolean) => <AmtButton cents={cents} metric={metric} bold={bold} onPick={click} />;

  const doClose = () => {
    const what = `Close ${view.selectionLabel}?\n\nThis locks the figures, creates the PDF report and emails it to every investor account. Make sure this month's expenses are all entered.`;
    if (!window.confirm(what)) return;
    start(async () => {
      const res = await closeMonth(view.selection, view.includeTest);
      if (!res.ok) setNote({ ok: false, text: res.error ?? "Could not close the month." });
      else setNote({ ok: !res.reportNote, text: `Month closed. Report emailed to ${res.sent ?? 0} investor${res.sent === 1 ? "" : "s"}.${res.reportNote ? ` ${res.reportNote}` : ""}` });
      router.refresh();
    });
  };
  const doReopen = () =>
    start(async () => {
      const res = await reopenMonth(view.selection, reason);
      setNote({ ok: res.ok, text: res.ok ? res.message ?? "Reopened." : res.error ?? "Could not reopen." });
      if (res.ok) { setReopening(false); setReason(""); }
      router.refresh();
    });
  const doResend = () => {
    if (!window.confirm(`Email the ${view.selectionLabel} report again to every investor${(view.state?.reportVersion ?? 1) > 1 ? " (marked as corrected)" : ""}?`)) return;
    start(async () => {
      const res = await resendReport(view.selection);
      setNote({ ok: res.ok && !res.reportNote, text: res.ok ? `Report emailed to ${res.sent ?? 0} investor${res.sent === 1 ? "" : "s"}.${res.reportNote ? ` ${res.reportNote}` : ""}` : res.error ?? "Could not send." });
      router.refresh();
    });
  };

  const chartA = barChartScene({
    title: "Revenue, costs and profit by month",
    categories: view.chartMonths.map((m) => { const [y, mm] = m.monthKey.split("-"); return `${MONTH_NAMES[Number(mm) - 1].slice(0, 3)} ${y.slice(2)}`; }),
    series: [
      { name: "Total revenue", values: view.chartMonths.map((m) => m.figures.totalRevenue / 100), color: PALETTE[0] },
      { name: "Costs (royalty, expenses, author tax)", values: view.chartMonths.map((m) => (m.figures.georgeRoyalty + m.figures.enteredExpenses + m.figures.authorTax) / 100), color: PALETTE[2] },
      { name: "Profit", values: view.chartMonths.map((m) => m.figures.profit / 100), color: PALETTE[1] },
    ],
  });
  const chartB = pieChartScene({
    title: `Where customers' money went: ${view.selectionLabel}`,
    slices: [
      { label: "Company share (after referral commissions)", value: f.companyNet / 100 },
      { label: "Author royalties", value: f.authorRoyalties / 100 },
      { label: "Referral earnings", value: f.referralEarnings / 100 },
      { label: "Promotion commissions", value: f.promotionCommissions / 100 },
      { label: "Pass-through to Lulu: printing", value: f.luluPrinting / 100 },
      { label: "Pass-through to Lulu: shipping", value: f.luluShipping / 100 },
      { label: "Pass-through to Lulu: fulfillment fee", value: f.luluFulfillment / 100 },
    ],
  });
  const chartC = barChartScene({
    title: `From revenue to retained: ${view.selectionLabel}`,
    categories: ["Total revenue", "Royalty 10%", "Expenses", "Author tax 5%", "Profit", "Income tax 30%", "Retained"],
    series: [{ name: "Amount", values: [f.totalRevenue, f.georgeRoyalty, f.enteredExpenses, f.authorTax, f.profit, f.incomeTax, f.retained].map((c) => c / 100), color: PALETTE[0] }],
    height: 290, valueLabels: true,
  });

  const tile = (label: string, cents: number, metric: Metric, sub?: string) => (
    <button key={label} type="button" className="stat-card" onClick={() => click(metric)} style={{ textAlign: "left", cursor: "pointer", border: "1px solid var(--line)" }} title="Click to see the transactions behind this figure">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{usdCents(cents)}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </button>
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Period picker + month status */}
      <div className="map-card" style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}>
        <label style={{ fontSize: 12 }}>Year<br />
          <select value={selYear ?? ""} onChange={(e) => { const y = Number(e.target.value); const inYear = view.months.filter((m) => m.monthKey.startsWith(String(y))); if (inYear.length) go(inYear[inYear.length - 1].monthKey); }}>
            {selYear === null && <option value="">All</option>}
            {view.years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Month<br />
          <select value={isMonth ? view.selection : ""} onChange={(e) => e.target.value && go(e.target.value)}>
            {!isMonth && <option value="">Choose a month</option>}
            {(isMonth ? monthsOfYear : view.months.slice().reverse()).map((m) => <option key={m.monthKey} value={m.monthKey}>{monthLabel(m.monthKey)}{m.status === "CLOSED" ? " (closed)" : ""}</option>)}
          </select>
        </label>
        <button type="button" className={`btn btn-small ${!isMonth ? "btn-primary" : "btn-ghost"}`} onClick={() => go("lifetime")}>Lifetime</button>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => go(view.currentMonthKey)}>This month</button>
        <label style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }} title="Orders paid with sandbox (test) money">
          <input type="checkbox" checked={view.includeTest} disabled={isMonth && isClosed} onChange={(e) => go(view.selection, e.target.checked)} /> Include test orders
        </label>
        <span style={{ flex: 1 }} />
        {!readOnly && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {isMonth && <a className="btn btn-primary btn-small" href={`/api/accounting/report?month=${view.selection}&${dlQ}`} title={isClosed ? "The locked report for this month" : "Made now from the current figures, marked Draft, Month Not Closed"}>Download Report: {monthLabel(view.selection)}{isClosed ? "" : " (draft)"}</a>}
            <a className="btn btn-ghost btn-small" href={`/api/accounting/report?year=${reportYear}&${dlQ}`} title="Made now from the current figures for the whole year">Download Report: {reportYear}</a>
          </div>
        )}
        {isMonth && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: isClosed ? "#1d4d36" : "#4d3e12", color: isClosed ? "#9be7c0" : "#f5d98a" }}>{isClosed ? "Closed (locked)" : "Open"}</span>
            {!readOnly && !isClosed && <button type="button" className="btn btn-primary btn-small" disabled={pending} onClick={doClose}>{pending ? "Working…" : "Close Month"}</button>}
            {!readOnly && isClosed && <button type="button" className="btn btn-ghost btn-small" disabled={pending} onClick={() => setReopening((v) => !v)}>Reopen month</button>}
            {!readOnly && isClosed && <button type="button" className="btn btn-ghost btn-small" disabled={pending} onClick={doResend}>Re-send report{(view.state?.reportVersion ?? 1) > 1 ? " (corrected)" : ""}</button>}
          </div>
        )}
      </div>

      {reopening && !readOnly && (
        <div className="map-card" style={{ padding: 16 }}>
          <p style={{ fontSize: 13 }}>Reopening unlocks this month so figures and expenses can be corrected. The reason and the locked figures are saved in the change log. Closing it again sends a corrected report to the investors.</p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} placeholder="Why is this month being reopened?" style={{ width: "100%", marginTop: 8 }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-primary btn-small" disabled={pending || reason.trim().length < 3} onClick={doReopen}>Reopen</button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setReopening(false)}>Cancel</button>
          </div>
        </div>
      )}
      {note && <div role="status" style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13.5, background: note.ok ? "rgba(79,208,143,0.15)" : "rgba(255,123,123,0.15)", border: `1px solid ${note.ok ? "var(--admin-success)" : "var(--admin-danger)"}` }}>{note.text}</div>}

      {view.isTestData && (
        <div role="status" style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: "rgba(214,40,40,0.12)", border: "2px solid #c82828" }}>
          <strong style={{ color: "#c82828", letterSpacing: 0.5 }}>TEST DATA.</strong>{" "}
          {view.testMode
            ? `Paystack is in ${view.gatewayModes.paystack} mode and PayPal is in ${view.gatewayModes.paypal} mode, so everything on this tab is test (sandbox) data, not real money. Every report downloaded from here carries a Test Data watermark.`
            : "The figures below include orders paid with test (sandbox) money, so they are not real money. Every report made from them carries a Test Data watermark."}
          {" "}{view.testOrders} test order{view.testOrders === 1 ? "" : "s"} and {view.liveOrders} real-money order{view.liveOrders === 1 ? "" : "s"} are in the shop&apos;s records.
          {isMonth && isClosed ? " A closed month keeps the setting it was closed with." : ""}
        </div>
      )}
      {!view.isTestData && view.testOrders > 0 && (
        <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: "rgba(240,192,77,0.14)", border: "1px solid var(--admin-warning)" }}>
          {view.testOrders} test order{view.testOrders === 1 ? " is" : "s are"} hidden from these figures (they are live-mode figures). Tick Include test orders to see them.
        </div>
      )}
      {view.archive && (
        <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
          Test figures archived {shortDateTime(view.archive.archivedAt)} by {view.archive.byName}: {view.archive.orders} test order(s){view.archive.includeExpenses ? ` and ${view.archive.expenses} expense(s)` : ""} are left out of these figures. Nothing was deleted.
        </div>
      )}
      {isClosed && view.state && (
        <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
          Closed {view.state.closedAt ? shortDateTime(view.state.closedAt) : ""} by {view.state.closedByName}. Report version {view.state.reportVersion}
          {view.state.lastReportSentAt ? `, last emailed ${shortDateTime(view.state.lastReportSentAt)} to ${view.state.lastReportRecipients ?? 0} investor(s)` : ", not emailed yet"}.
          {view.state.reopenedAt ? ` Previously reopened ${shortDateTime(view.state.reopenedAt)} by ${view.state.reopenedByName}${view.state.reopenReason ? ` (${view.state.reopenReason})` : ""}.` : ""}
        </div>
      )}
      {!isClosed && view.state?.reopenedAt && (
        <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Reopened {shortDateTime(view.state.reopenedAt)} by {view.state.reopenedByName}. Reason: {view.state.reopenReason}. Figures are live until the month is closed again.</div>
      )}
      {view.drift && !readOnly && (
        <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: "rgba(255,123,123,0.12)", border: "1px solid var(--admin-danger)" }}>
          The locked figures for this month no longer match the live sales data (something was recalculated after closing). The locked figures are what is shown and what investors received. To correct them, reopen the month and close it again.
        </div>
      )}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {tile("Total revenue", f.totalRevenue, "totalRevenue", "before tax")}
        {tile("Profit", f.profit, "profit", "after royalty, expenses and 5% author tax")}
        {tile("Income tax (30%)", f.incomeTax, "incomeTax", "of profit")}
        {tile("Retained", f.retained, "retained", "after income tax")}
        <div className="stat-card">
          <div className="stat-label">Books published</div>
          <div className="stat-value">{view.companyBooksPublished}</div>
          <div className="stat-sub">{view.companyAccountFound ? "in author account 30000064 (as of now)" : "company author account 30000064 not found"}</div>
        </div>
      </div>

      <Card title={`The calculation: ${view.selectionLabel}`}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <CalcRow n="1" label="Company sales revenue" sub={<>30% share of eBook, Audiobook and Print sales {amt(f.companyGrossShare, "companyGrossShare")} minus referral commissions paid out of it {amt(f.referralCommissions, "referralCommissions")}</>} amount={amt(f.salesRevenue, "salesRevenue", true)} />
            <CalcRow n="2" label="Company author account 30000064 (gross)" sub={<>royalties {amt(f.acctRoyalties, "acctRoyalties")}, referral earnings {amt(f.acctReferral, "acctReferral")}, promotion earnings {amt(f.acctPromotion, "acctPromotion")}</>} amount={amt(f.acctGross, "acctGross", true)} />
            <CalcRow n="3" label="Total revenue (before tax)" strong amount={amt(f.totalRevenue, "totalRevenue", true)} />
            <CalcRow n="4" label="Royalty to George Otieno (10% of total revenue)" amount={<><span>-</span>{amt(f.georgeRoyalty, "georgeRoyalty")}</>} />
            <CalcRow n="5" label="Other company expenses" sub={<>entered by the admin {amt(f.enteredExpenses, "enteredExpenses")} plus the 10% royalty = <strong>{usdCents(f.otherExpenses)}</strong> (the royalty is counted once)</>} amount={<><span>-</span>{amt(f.enteredExpenses, "enteredExpenses")}</>} />
            <CalcRow n="6" label="Tax on the author account (5% of its earnings)" sub="Taken as a cost before profit, so it lowers profit and therefore the income tax." amount={<><span>-</span>{amt(f.authorTax, "authorTax")}</>} />
            <CalcRow n="7" label="Profit" strong amount={amt(f.profit, "profit", true)} />
            <CalcRow n="8" label="Income tax (30% of profit; none in a loss month)" amount={<><span>-</span>{amt(f.incomeTax, "incomeTax")}</>} />
            <CalcRow n="" label="Retained by the company after income tax" strong amount={amt(f.retained, "retained", true)} />
          </tbody>
        </table>
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13.5 }}>How each figure is worked out, in plain words</summary>
          <ol style={{ margin: "10px 0 0 18px", fontSize: 13, display: "grid", gap: 6 }}>
            {FORMULA_STEPS.map((s) => <li key={s.n}><strong>{s.title}.</strong> {s.words}</li>)}
          </ol>
          {!isMonth && <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 8 }}>The lifetime figures are the sum of the months below, so a month and the lifetime always agree to the cent.</p>}
        </details>
      </Card>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <div className="map-card" style={{ padding: 12 }}><Chart3D scene={chartA} /></div>
        <div className="map-card" style={{ padding: 12 }}><Chart3D scene={chartB} /></div>
        <div className="map-card" style={{ padding: 12 }}><Chart3D scene={chartC} /></div>
      </div>

      <Card title={`Breakdown of all money received: ${view.selectionLabel}`}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <MoneyRow label="Company share (30%, after referral commissions)" amount={amt(f.companyNet, "salesRevenue")} />
            <MoneyRow label="Author royalties (all authors)" amount={amt(f.authorRoyalties, "authorRoyalties")} />
            <MoneyRow label="Referral earnings" amount={amt(f.referralEarnings, "referralEarnings")} />
            <MoneyRow label="Promotion commissions" amount={amt(f.promotionCommissions, "promotionCommissions")} />
            <MoneyRow label="Pass-through to Lulu: printing cost" amount={amt(f.luluPrinting, "luluPrinting")} />
            <MoneyRow label="Pass-through to Lulu: shipping" amount={amt(f.luluShipping, "luluShipping")} />
            <MoneyRow label="Pass-through to Lulu: fulfillment fee" amount={amt(f.luluFulfillment, "luluFulfillment")} />
            <MoneyRow label="Difference not explained (should be $0.00)" amount={<span style={{ color: f.unreconciled === 0 ? undefined : "var(--admin-danger)" }}>{usdCents(f.unreconciled)}</span>} />
            <MoneyRow label={`Total paid by customers (${f.orders} orders)`} strong amount={amt(f.customersPaid, "customersPaid", true)} />
          </tbody>
        </table>
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 8 }}>
          Lulu printing, shipping and the fulfillment fee are paid by customers and passed to Lulu. They are never company revenue or cost. A non-zero difference means some orders carry an amount this breakdown cannot explain (for example an older order made before a charge was recorded).
        </p>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 12 }}>
          <div className="stat-card"><div className="stat-label">Paid out in this period</div><div className="stat-value">{usd(view.payoutsPaidTotal)}</div><div className="stat-sub">{view.payouts.length} payouts. Payouts do not reduce company revenue.</div></div>
          <div className="stat-card"><div className="stat-label">Still owed (earned, not paid)</div><div className="stat-value">{usd(view.owed.owed)}</div><div className="stat-sub">{usd(view.owed.onHold)} held back, {usd(view.owed.queued)} queued, {usd(view.owed.available)} available ({usd(view.owed.belowMinimum)} below the {usd(view.minimumPayout)} minimum)</div></div>
        </div>
      </Card>

      <ExpensesSection expenses={view.expenses} readOnly={readOnly} locked={isClosed} selection={view.selection} includeTest={view.includeTest} />

      <Card title="Payouts made" actions={<ExportLinks table="payouts" selection={view.selection} includeTest={view.includeTest} show={!readOnly} />}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={TH_STYLE}>Date</th><th style={TH_STYLE}>Recipient</th><th style={TH_STYLE}>Type</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Amount</th><th style={TH_STYLE}>Method</th><th style={TH_STYLE}>Reference</th><th style={TH_STYLE}>Earnings covered</th></tr></thead>
            <tbody>
              {view.payouts.length === 0 && <tr><td style={TD_STYLE} colSpan={7}>No payouts were paid in this period.</td></tr>}
              {view.payouts.map((p) => (
                <tr key={p.id}>
                  <td style={TD_STYLE}>{shortDate(p.date)}</td>
                  <td style={TD_STYLE}>{p.recipient}<div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{p.accountNumber}</div></td>
                  <td style={TD_STYLE}>{p.kind === "AUTHOR" ? "Author" : "Affiliate"}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usd(p.amount)}</td>
                  <td style={TD_STYLE}>{p.method}</td>
                  <td style={TD_STYLE}>{p.reference}</td>
                  <td style={TD_STYLE}>{p.kind === "AUTHOR" ? "Book royalties" : "Affiliate earnings"} for {monthLabel(p.coversMonth)}</td>
                </tr>
              ))}
              <tr><td style={{ ...TD_STYLE, fontWeight: 700 }} colSpan={3}>Total paid out</td><td style={{ ...TD_STYLE, textAlign: "right", fontWeight: 700 }}>{usd(view.payoutsPaidTotal)}</td><td colSpan={3} style={TD_STYLE}></td></tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6 }}>Payouts are sent by hand outside the site, so the reference is the payout request number, not a bank reference.</p>
      </Card>

      <Card title="Still owed to authors and affiliates" actions={<ExportLinks table="owed" selection={view.selection} includeTest={view.includeTest} show={!readOnly} />}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={TH_STYLE}>Recipient</th><th style={TH_STYLE}>Type</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Earned</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Paid</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Held back</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Queued</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Available</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Owed</th></tr></thead>
            <tbody>
              {view.owedRows.length === 0 && <tr><td style={TD_STYLE} colSpan={8}>Nobody is owed anything.</td></tr>}
              {view.owedRows.map((o) => (
                <tr key={`${o.userId}-${o.kind}`}>
                  <td style={TD_STYLE}>{o.name}<div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{o.accountNumber}</div></td>
                  <td style={TD_STYLE}>{o.kind === "AUTHOR" ? "Author" : "Affiliate"}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usd(o.earned)}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usd(o.paid)}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usd(o.onHold)}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usd(o.queued)}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usd(o.available)}{o.belowMinimum ? <div style={{ fontSize: 11, color: "var(--admin-warning)" }}>below minimum</div> : null}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right", fontWeight: 700 }}>{usd(o.owed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6 }}>As at the end of the period. Earnings are released on the 1st of the month after they were earned; balances below the minimum payout roll to the next month. The company&apos;s own author account is not listed (it is the company).</p>
      </Card>

      <Card title="Lulu ledger" actions={<ExportLinks table="lulu" selection={view.selection} includeTest={view.includeTest} show={!readOnly} />}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={TH_STYLE}>Order</th><th style={TH_STYLE}>Date</th><th style={TH_STYLE}>Book</th><th style={TH_STYLE}>Format</th><th style={TH_STYLE}>Customer ref</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Printing</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Shipping</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Fulfillment</th><th style={TH_STYLE}>Lulu order no.</th><th style={TH_STYLE}>Lulu status</th></tr></thead>
            <tbody>
              {view.lulu.length === 0 && <tr><td style={TD_STYLE} colSpan={10}>No printed orders in this period.</td></tr>}
              {view.lulu.slice(0, 300).map((r) => (
                <tr key={r.orderId}>
                  <td style={TD_STYLE}>#{r.orderNumber}</td>
                  <td style={TD_STYLE}>{shortDate(r.date)}</td>
                  <td style={TD_STYLE}>{r.books}{r.isTest ? <span style={{ color: "var(--ink-faint)" }}> (test)</span> : null}</td>
                  <td style={TD_STYLE}>{r.formats}</td>
                  <td style={TD_STYLE}>#{r.customerRef}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usd(r.printingCost)}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usd(r.shipping)}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usd(r.fulfillment)}</td>
                  <td style={TD_STYLE}>{r.luluOrderNumber}</td>
                  <td style={TD_STYLE}>{r.luluStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {view.lulu.length > 300 && <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6 }}>Showing the latest 300 orders. Export for the full ledger.</p>}
        <h4 style={{ fontSize: 13.5, margin: "16px 0 6px" }}>Monthly totals: what customers paid and what Lulu charges</h4>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={TH_STYLE}>Month</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Orders</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Customers paid (printing + shipping + fulfillment)</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Lulu charges</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Difference</th></tr></thead>
            <tbody>
              {view.luluMonthly.length === 0 && <tr><td style={TD_STYLE} colSpan={5}>No printed orders yet.</td></tr>}
              {view.luluMonthly.map((m) => (
                <tr key={m.monthKey}>
                  <td style={TD_STYLE}>{m.label}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{m.totals.orders}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usd(m.totals.paidProduction + m.totals.paidShipping + m.totals.paidFulfillment)}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usd(m.totals.luluTotal)}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usd(m.totals.grandDifference)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6 }}>Use these monthly totals to match Lulu&apos;s invoices. A difference of $0.00 means customers paid exactly what Lulu charges; the amounts are Lulu&apos;s own once an order has been checked with Lulu, otherwise the quote saved when the order was placed.</p>
      </Card>

      <Card title="Month by month" actions={<ExportLinks table="monthly" selection={view.selection} includeTest={view.includeTest} show={!readOnly} />}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={TH_STYLE}>Month</th><th style={TH_STYLE}>Status</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Total revenue</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Royalty 10%</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Expenses</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Author tax 5%</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Profit</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Income tax 30%</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Retained</th></tr></thead>
            <tbody>
              {view.months.slice().reverse().map((m) => (
                <tr key={m.monthKey} style={{ cursor: "pointer", background: m.monthKey === view.selection ? "var(--admin-accent-soft)" : undefined }} onClick={() => go(m.monthKey)}>
                  <td style={TD_STYLE}>{monthLabel(m.monthKey)}</td>
                  <td style={TD_STYLE}>{m.status === "CLOSED" ? "Closed" : "Open"}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usdCents(m.figures.totalRevenue)}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usdCents(m.figures.georgeRoyalty)}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usdCents(m.figures.enteredExpenses)}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usdCents(m.figures.authorTax)}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usdCents(m.figures.profit)}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usdCents(m.figures.incomeTax)}</td>
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>{usdCents(m.figures.retained)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Change log" actions={<ExportLinks table="changelog" selection={view.selection} includeTest={view.includeTest} show={!readOnly} />}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={TH_STYLE}>When</th><th style={TH_STYLE}>Month</th><th style={TH_STYLE}>Who</th><th style={TH_STYLE}>What</th></tr></thead>
            <tbody>
              {view.changeLog.length === 0 && <tr><td style={TD_STYLE} colSpan={4}>Nothing has been changed yet.</td></tr>}
              {view.changeLog.map((l) => (
                <tr key={l.id}>
                  <td style={TD_STYLE}>{shortDateTime(l.createdAt)}</td>
                  <td style={TD_STYLE}>{monthLabel(l.monthKey)}</td>
                  <td style={TD_STYLE}>{l.actorName}</td>
                  <td style={TD_STYLE}>{l.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

            <ReportsCard view={view} readOnly={readOnly} />
      {!readOnly && <TestDataPanel view={view} />}

      {drill && <DrillModal selection={view.selection} metric={drill} includeTest={view.includeTest} canDownload={!readOnly} onClose={() => setDrill(null)} />}
    </div>
  );
}

function AmtButton({ cents, metric, bold, onPick }: { cents: number; metric: Metric; bold?: boolean; onPick: (m: Metric) => void }) {
  return (
    <button type="button" onClick={() => onPick(metric)} title="Click to see the transactions behind this figure" style={{ background: "none", border: 0, padding: 0, font: "inherit", color: "var(--admin-accent)", textDecoration: "underline dotted", cursor: "pointer", fontWeight: bold ? 700 : 400 }}>
      {usdCents(cents)}
    </button>
  );
}

function CalcRow({ n, label, sub, amount, strong }: { n: string; label: string; sub?: React.ReactNode; amount: React.ReactNode; strong?: boolean }) {
  return (
    <tr style={strong ? { background: "var(--admin-accent-soft)" } : undefined}>
      <td style={{ ...TD_STYLE, width: 28, color: "var(--ink-faint)" }}>{n}</td>
      <td style={{ ...TD_STYLE, fontWeight: strong ? 700 : 400 }}>{label}{sub && <div style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 400, marginTop: 2 }}>{sub}</div>}</td>
      <td style={{ ...TD_STYLE, textAlign: "right", whiteSpace: "nowrap" }}>{amount}</td>
    </tr>
  );
}

function MoneyRow({ label, amount, strong }: { label: string; amount: React.ReactNode; strong?: boolean }) {
  return (
    <tr style={strong ? { background: "var(--admin-accent-soft)" } : undefined}>
      <td style={{ ...TD_STYLE, fontWeight: strong ? 700 : 400 }}>{label}</td>
      <td style={{ ...TD_STYLE, textAlign: "right" }}>{amount}</td>
    </tr>
  );
}

function ReportsCard({ view, readOnly }: { view: AccountingView; readOnly: boolean }) {
  return (
    <Card title="Reports">
      <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 8 }}>Every report emailed to the investors at month close (or re-sent) is kept here.{readOnly ? " Only an Admin can download them." : ""}</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={TH_STYLE}>Month</th><th style={TH_STYLE}>Date sent</th><th style={TH_STYLE}>Version</th><th style={TH_STYLE}>Emailed to</th><th style={TH_STYLE}>Data</th>{!readOnly && <th style={TH_STYLE}>Download</th>}</tr></thead>
          <tbody>
            {view.reports.length === 0 && <tr><td style={TD_STYLE} colSpan={readOnly ? 5 : 6}>No report has been made yet. One is made and emailed each time a month is closed.</td></tr>}
            {view.reports.map((r) => (
              <tr key={r.id}>
                <td style={TD_STYLE}>{r.label}</td>
                <td style={TD_STYLE}>{shortDateTime(r.sentAt)}</td>
                <td style={TD_STYLE}>{r.version > 1 ? `${r.version} (corrected)` : r.version}</td>
                <td style={TD_STYLE}>{r.sentTo > 0 ? `${r.sentTo} investor${r.sentTo === 1 ? "" : "s"}` : "Not emailed"}</td>
                <td style={TD_STYLE}>{r.testData ? <strong style={{ color: "#c82828" }}>Test Data</strong> : "Live"}</td>
                {!readOnly && <td style={TD_STYLE}><a className="btn btn-ghost btn-small" href={`/api/accounting/report?id=${encodeURIComponent(r.id)}`}>Download PDF</a></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Admin only: what the figures are made from, and the confirmed action that archives test figures. */
function TestDataPanel({ view }: { view: AccountingView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [phrase, setPhrase] = useState("");
  const [alsoExpenses, setAlsoExpenses] = useState(false);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const a = view.audit;
  if (!a) return null;
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      setMsg({ ok: res.ok, text: res.ok ? res.message ?? "Done." : res.error ?? "Could not do that." });
      if (res.ok) { setOpen(false); setPhrase(""); }
      router.refresh();
    });
  return (
    <Card title="Test data">
      <div style={{ fontSize: 13, display: "grid", gap: 6 }}>
        <div>
          Payment mode: Paystack <strong>{view.gatewayModes.paystack}</strong>, PayPal <strong>{view.gatewayModes.paypal}</strong>. This tab is labelled <strong>{view.testMode ? "Test Data" : "live"}</strong> from this setting.
        </div>
        <div>
          Of the {a.paidOrders} paid order(s) feeding this tab, <strong>{a.testOrders}</strong> are test data ({a.flaggedOnOrder} flagged on the order, {a.testByGatewayOnly} identified from a payment made in test mode)
          and <strong style={{ color: a.liveOrderCount > 0 ? "var(--admin-danger)" : undefined }}>{a.liveOrderCount}</strong> are not.
          {a.allTest ? " All the order data feeding this tab is test data." : " These real-money orders are NOT test data:"}
        </div>
        {a.liveOrders.length > 0 && (
          <ul style={{ margin: "0 0 0 18px" }}>
            {a.liveOrders.map((o) => <li key={o.ref}>#{o.ref}, {shortDate(o.date)}, {usd(o.total)}</li>)}
            {a.liveOrderCount > a.liveOrders.length && <li>and {a.liveOrderCount - a.liveOrders.length} more</li>}
          </ul>
        )}
        <div style={{ color: "var(--ink-soft)" }}>
          Also feeding the tab: {a.expenses} expense(s) entered by an admin and {a.payoutRequests} payout request(s). These are not marked test or live by the shop, so check them yourself before going live.
          {a.closedMonthsWithTest.length > 0 ? ` Closed months built with test data: ${a.closedMonthsWithTest.join(", ")} (their locked reports carry the Test Data label).` : ""}
          {a.archivedTestOrders > 0 ? ` ${a.archivedTestOrders} test order(s) are currently archived (left out).` : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-ghost btn-small" disabled={pending} onClick={() => setOpen((v) => !v)}>Archive test figures…</button>
        {view.archive && <button type="button" className="btn btn-ghost btn-small" disabled={pending} onClick={() => { if (window.confirm("Bring the archived test data back into the Accounting figures?")) run(() => restoreTestData()); }}>Restore archived test data</button>}
      </div>
      {open && (
        <div style={{ marginTop: 10, padding: 12, border: "1px solid var(--admin-warning)", borderRadius: 8, fontSize: 13 }}>
          <p>This leaves every test (sandbox) order placed so far out of the Accounting figures, so they start clean for going live. <strong>Nothing is deleted</strong>: orders and payments stay in the shop, and you can restore them here. Closed months keep their locked figures and reports. The action is recorded in the change log.</p>
          <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}><input type="checkbox" checked={alsoExpenses} onChange={(e) => setAlsoExpenses(e.target.checked)} /> Also leave out the {a.expenses} expense(s) entered so far (use this only if they were test entries)</label>
          <label style={{ display: "block", marginTop: 8 }}>Type <strong>ARCHIVE TEST DATA</strong> to confirm<br />
            <input value={phrase} onChange={(e) => setPhrase(e.target.value)} style={{ width: 260 }} autoComplete="off" />
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-primary btn-small" disabled={pending || phrase.trim() !== "ARCHIVE TEST DATA"} onClick={() => run(() => archiveTestData(phrase, alsoExpenses))}>{pending ? "Working…" : "Archive test figures"}</button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
      {msg && <div role="status" style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, fontSize: 13, background: msg.ok ? "rgba(79,208,143,0.15)" : "rgba(255,123,123,0.15)" }}>{msg.text}</div>}
    </Card>
  );
}
