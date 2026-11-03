import type { AccountingView, Drill } from "@/lib/accounting/service";
import { dollars } from "@/lib/accounting/calc";
import { monthLabel } from "@/lib/accounting/period";

/**
 * The lists and ledgers that can be exported as CSV or PDF. Each is a plain table of text, so the CSV and the PDF always
 * hold exactly the same rows. Pure code.
 */

export interface ExportTable {
  title: string;
  subtitle: string;
  headers: string[];
  aligns: ("left" | "right")[];
  rows: string[][];
  filename: string;
}

const m2 = (n: number | null) => (n == null ? "" : n.toFixed(2));
const day = (iso: string) => iso.slice(0, 10);

export const EXPORT_TABLES = ["expenses", "payouts", "owed", "lulu", "monthly", "changelog", "drill"] as const;
export type ExportTableName = (typeof EXPORT_TABLES)[number];

export function buildExportTable(name: ExportTableName, view: AccountingView, drill?: Drill | null): ExportTable | null {
  const period = view.selectionLabel;
  const slug = view.selection;
  switch (name) {
    case "expenses":
      return {
        title: "Expenses", subtitle: period, filename: `gcb-expenses-${slug}`,
        headers: ["Date", "Category", "Description", "Amount (USD)", "Entered by", "Entered at", "Receipt"],
        aligns: ["left", "left", "left", "right", "left", "left", "left"],
        rows: view.expenses.map((e) => [e.date, e.category, e.description, m2(e.amount), e.enteredByName ?? "", e.enteredAt ? e.enteredAt.slice(0, 16).replace("T", " ") : "", e.receiptName ?? ""]),
      };
    case "payouts":
      return {
        title: "Payouts made", subtitle: period, filename: `gcb-payouts-${slug}`,
        headers: ["Date", "Recipient", "Account", "Type", "Amount (USD)", "Method", "Reference", "Earnings month covered"],
        aligns: ["left", "left", "left", "left", "right", "left", "left", "left"],
        rows: view.payouts.map((p) => [day(p.date), p.recipient, p.accountNumber, p.kind === "AUTHOR" ? "Author" : "Affiliate", m2(p.amount), p.method, p.reference, p.coversMonth]),
      };
    case "owed":
      return {
        title: "Amounts still owed to authors and affiliates", subtitle: period, filename: `gcb-owed-${slug}`,
        headers: ["Recipient", "Account", "Type", "Earned", "Paid", "Queued", "Held back", "Available", "Owed", "Below minimum"],
        aligns: ["left", "left", "left", "right", "right", "right", "right", "right", "right", "left"],
        rows: view.owedRows.map((o) => [o.name, o.accountNumber, o.kind === "AUTHOR" ? "Author" : "Affiliate", m2(o.earned), m2(o.paid), m2(o.queued), m2(o.onHold), m2(o.available), m2(o.owed), o.belowMinimum ? "Yes" : "No"]),
      };
    case "lulu":
      return {
        title: "Lulu ledger", subtitle: period, filename: `gcb-lulu-ledger-${slug}`,
        headers: ["Order number", "Date", "Book", "Format", "Customer order ref", "Printing cost", "Shipping", "Fulfillment fee", "Lulu order number", "Lulu status"],
        aligns: ["left", "left", "left", "left", "left", "right", "right", "right", "left", "left"],
        rows: view.lulu.map((r) => [`#${r.orderNumber}`, day(r.date), r.books, r.formats, `#${r.customerRef}`, m2(r.printingCost), m2(r.shipping), m2(r.fulfillment), r.luluOrderNumber, r.luluStatus]),
      };
    case "monthly":
      return {
        title: "Month by month", subtitle: "All figures in USD", filename: "gcb-accounting-monthly",
        headers: ["Month", "Status", "Paid by customers", "Company sales revenue", "Author account (gross)", "Total revenue", "Royalty 10%", "Expenses entered", "Author tax 5%", "Profit", "Income tax 30%", "Retained"],
        aligns: ["left", "left", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right"],
        rows: [
          ...view.months.map((s) => [monthLabel(s.monthKey), s.status === "CLOSED" ? "Closed" : "Open", ...monthCells(s.figures)]),
          ["Lifetime", "", ...monthCells(lifetimeOf(view))],
        ],
      };
    case "changelog":
      return {
        title: "Change log", subtitle: period, filename: `gcb-accounting-log-${slug}`,
        headers: ["When", "Month", "Who", "What"],
        aligns: ["left", "left", "left", "left"],
        rows: view.changeLog.map((l) => [l.createdAt.slice(0, 16).replace("T", " "), l.monthKey, l.actorName, l.summary]),
      };
    case "drill":
      if (!drill) return null;
      return {
        title: drill.title, subtitle: period, filename: `gcb-${drill.metric}-${slug}`,
        headers: ["Date", "Reference", "Description", "Amount (USD)", "Note"],
        aligns: ["left", "left", "left", "right", "left"],
        rows: [...drill.rows.map((r) => [r.date ? day(r.date) : "", r.ref, r.description, r.amount.toFixed(2), r.note ?? ""]), ["", "", "Total", drill.total.toFixed(2), ""]],
      };
  }
}

function lifetimeOf(view: AccountingView) {
  // The lifetime row is the sum of the month rows shown above it.
  const t = { ...view.months[0]?.figures };
  const keys = Object.keys(t).filter((k) => k !== "monthKey") as (keyof typeof t)[];
  for (const k of keys) (t[k] as number) = view.months.reduce((s, m) => s + (m.figures[k] as number), 0);
  return t as AccountingView["figures"];
}

function monthCells(f: AccountingView["figures"]): string[] {
  return [f.customersPaid, f.salesRevenue, f.acctGross, f.totalRevenue, f.georgeRoyalty, f.enteredExpenses, f.authorTax, f.profit, f.incomeTax, f.retained].map((c) => dollars(c).toFixed(2));
}

/** CSV with every cell quoted. A cell that starts with = + - @ is prefixed with a quote so a spreadsheet never runs it as a formula. */
export function toCsv(t: ExportTable): string {
  const cell = (v: string) => {
    let s = v;
    if (/^[=+@]/.test(s) || (/^-/.test(s) && !/^-\d+(\.\d+)?$/.test(s))) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [t.headers, ...t.rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
