import { prisma } from "@/lib/prisma";
import { loadMinimumPayout } from "@/lib/payout-minimum";
import {
  computeMonth, sumMonths, lineContribution, orderContribution, cents, dollars, type ExpenseRow, type Metric, type MonthCents, type SaleRow,
} from "@/lib/accounting/calc";
import { computeOwed, totalOwed, type OwedRow, type OwedTotals, type PayoutRow } from "@/lib/accounting/payouts";
import { loadAccountingSource, luluTotalsFor, type AccountingSource, type LuluLedgerRow } from "@/lib/accounting/data";
import { monthBounds, monthKeyOf, monthLabel, monthRange, nextMonthKey, previousMonthKey, shortMonthLabel } from "@/lib/accounting/period";
import type { LuluTotals } from "@/lib/lulu-report";

/**
 * Builds what the Accounting page, the exports and the PDF report show. Server only.
 * A CLOSED month shows the figures saved when it was closed; everything else is worked out live.
 */

export interface PayoutDisplay {
  id: string;
  reference: string;
  date: string; // ISO (paid date, or queued date when not yet paid)
  recipient: string;
  accountNumber: string;
  kind: "AUTHOR" | "AFFILIATE";
  amount: number;
  status: string;
  method: string;
  coversMonth: string;
}

export interface LuluDisplay {
  orderId: string;
  orderNumber: string;
  customerRef: string;
  date: string;
  books: string;
  formats: string;
  printingCost: number | null;
  shipping: number | null;
  fulfillment: number | null;
  luluOrderNumber: string;
  luluStatus: string;
  isTest: boolean;
}

export interface MonthSnapshot {
  version: 1;
  takenAt: string;
  includeTest: boolean;
  figures: MonthCents;
  expenses: ExpenseRow[];
  payouts: PayoutDisplay[];
  payoutsPaidTotal: number;
  owed: OwedTotals;
  owedRows: OwedRow[];
  lulu: LuluTotals;
  luluOrders: number;
  companyBooksPublished: number;
  testOrders: number;
  /** The last 12 months up to this one (oldest first), for the report's bar chart. Dollars. */
  trend?: { label: string; revenue: number; costs: number; profit: number }[];
}

export interface MonthState {
  monthKey: string;
  status: "OPEN" | "CLOSED";
  closedAt: string | null;
  closedByName: string | null;
  reportVersion: number;
  lastReportSentAt: string | null;
  lastReportRecipients: number | null;
  reopenedAt: string | null;
  reopenedByName: string | null;
  reopenReason: string | null;
}

export interface ChangeLogDisplay {
  id: string;
  monthKey: string;
  action: string;
  actorName: string;
  summary: string;
  details: unknown;
  createdAt: string;
}

export interface MonthSummary {
  monthKey: string;
  label: string;
  status: "OPEN" | "CLOSED";
  figures: MonthCents;
}

export interface AccountingView {
  selection: string; // "lifetime" or "YYYY-MM"
  selectionLabel: string;
  includeTest: boolean;
  testOrders: number;
  liveOrders: number;
  months: MonthSummary[];
  years: number[];
  currentMonthKey: string;
  figures: MonthCents;
  state: MonthState | null;
  locked: boolean;
  /** True when a closed month's saved figures no longer match what the live data now says. */
  drift: boolean;
  expenses: ExpenseRow[];
  payouts: PayoutDisplay[];
  payoutsPaidTotal: number;
  owed: OwedTotals;
  owedRows: OwedRow[];
  minimumPayout: number;
  lulu: LuluDisplay[];
  luluTotals: LuluTotals;
  luluMonthly: { monthKey: string; label: string; totals: LuluTotals }[];
  companyBooksPublished: number;
  companyAccountFound: boolean;
  changeLog: ChangeLogDisplay[];
  chartMonths: MonthSummary[];
}

const iso = (d: Date) => d.toISOString();

export function stateFromRow(row: { monthKey: string; status: string; closedAt: Date | null; closedByName: string | null; reportVersion: number; lastReportSentAt: Date | null; lastReportRecipients: number | null; reopenedAt: Date | null; reopenedByName: string | null; reopenReason: string | null }): MonthState {
  return {
    monthKey: row.monthKey,
    status: row.status === "CLOSED" ? "CLOSED" : "OPEN",
    closedAt: row.closedAt ? iso(row.closedAt) : null,
    closedByName: row.closedByName,
    reportVersion: row.reportVersion,
    lastReportSentAt: row.lastReportSentAt ? iso(row.lastReportSentAt) : null,
    lastReportRecipients: row.lastReportRecipients,
    reopenedAt: row.reopenedAt ? iso(row.reopenedAt) : null,
    reopenedByName: row.reopenedByName,
    reopenReason: row.reopenReason,
  };
}

function inMonth(d: Date, key: string): boolean {
  return monthKeyOf(d) === key;
}

function toPayoutDisplay(p: PayoutRow): PayoutDisplay {
  return {
    id: p.id, reference: p.reference, date: iso(p.resolvedAt ?? p.requestedAt), recipient: p.recipientName, accountNumber: p.accountNumber,
    kind: p.kind, amount: p.amount, status: p.status, method: p.method, coversMonth: p.coversMonth,
  };
}

function toLuluDisplay(r: LuluLedgerRow): LuluDisplay {
  return {
    orderId: r.orderId, orderNumber: r.orderNumber, customerRef: r.customerRef, date: iso(r.createdAt), books: r.books, formats: r.formats,
    printingCost: r.printingCost, shipping: r.shipping, fulfillment: r.fulfillment, luluOrderNumber: r.luluOrderNumber, luluStatus: r.luluStatus, isTest: r.isTest,
  };
}

/** The sale lines, orders and expenses that belong to one month (Nairobi time), honouring the test-money switch. */
export function sliceMonth(src: AccountingSource, key: string, includeTest: boolean) {
  return {
    sales: src.sales.filter((s) => inMonth(s.createdAt, key) && (includeTest || !s.isTest)),
    orders: src.orders.filter((o) => inMonth(o.createdAt, key) && (includeTest || !o.isTest)),
    expenses: src.expenses.filter((e) => e.monthKey === key),
  };
}

/** Everything the saved snapshot of a month holds, worked out live. */
export async function buildSnapshot(src: AccountingSource, key: string, includeTest: boolean): Promise<MonthSnapshot> {
  const { sales, orders, expenses } = sliceMonth(src, key, includeTest);
  const figures = computeMonth(key, sales, orders, expenses);
  const { start, end } = monthBounds(key);
  const minimum = await loadMinimumPayout();
  const payouts = src.payouts
    .filter((p) => p.status === "PAID" && p.resolvedAt && p.resolvedAt >= start && p.resolvedAt < end)
    .map(toPayoutDisplay);
  const owedRows = computeOwed(src.earnings, src.payouts, end, minimum);
  const luluRows = src.lulu.filter((r) => inMonth(r.createdAt, key) && (includeTest || !r.isTest));
  const trendKeys: string[] = [];
  for (let k = key, i = 0; i < 12; i++, k = previousMonthKey(k)) trendKeys.unshift(k);
  const trend = trendKeys.map((k) => {
    const sl = sliceMonth(src, k, includeTest);
    const f = computeMonth(k, sl.sales, sl.orders, sl.expenses);
    return { label: shortMonthLabel(k), revenue: dollars(f.totalRevenue), costs: dollars(f.georgeRoyalty + f.enteredExpenses + f.authorTax), profit: dollars(f.profit) };
  });
  return {
    version: 1,
    takenAt: iso(new Date()),
    includeTest,
    figures,
    expenses,
    payouts,
    payoutsPaidTotal: dollars(payouts.reduce((s, p) => s + cents(p.amount), 0)),
    owed: totalOwed(owedRows),
    owedRows: owedRows.slice(0, 200),
    lulu: luluTotalsFor(luluRows),
    luluOrders: luluRows.length,
    companyBooksPublished: src.companyBooksPublished,
    testOrders: new Set(src.orders.filter((o) => inMonth(o.createdAt, key) && o.isTest).map((o) => o.orderId)).size,
    trend,
  };
}

export function isSnapshot(v: unknown): v is MonthSnapshot {
  return !!v && typeof v === "object" && (v as MonthSnapshot).version === 1 && typeof (v as MonthSnapshot).figures === "object";
}

export async function loadMonthStates(): Promise<Map<string, { state: MonthState; snapshot: MonthSnapshot | null }>> {
  const rows = await prisma.accountingMonth.findMany();
  const map = new Map<string, { state: MonthState; snapshot: MonthSnapshot | null }>();
  for (const r of rows) map.set(r.monthKey, { state: stateFromRow(r), snapshot: r.status === "CLOSED" && isSnapshot(r.snapshot) ? r.snapshot : null });
  return map;
}

/** The first month with any activity through the current month, so lifetime covers everything. */
export function activeMonthKeys(src: AccountingSource, closed: Iterable<string>, now: Date = new Date()): string[] {
  const keys: string[] = [monthKeyOf(now)];
  for (const s of src.orders) keys.push(monthKeyOf(s.createdAt));
  for (const e of src.expenses) keys.push(e.monthKey);
  for (const p of src.payouts) keys.push(monthKeyOf(p.resolvedAt ?? p.requestedAt));
  for (const k of closed) keys.push(k);
  keys.sort();
  return monthRange(keys[0], monthKeyOf(now) > keys[keys.length - 1] ? monthKeyOf(now) : keys[keys.length - 1]);
}

const FIGURE_KEYS_TO_COMPARE: (keyof MonthCents)[] = ["totalRevenue", "profit", "salesRevenue", "acctGross", "enteredExpenses", "customersPaid"];

export async function buildAccountingView(selection: string, includeTest: boolean, now: Date = new Date()): Promise<AccountingView> {
  const [src, states, minimum] = await Promise.all([loadAccountingSource(), loadMonthStates(), loadMinimumPayout()]);
  const keys = activeMonthKeys(src, states.keys(), now);
  const currentMonthKey = monthKeyOf(now);

  // Each month's figures: locked snapshot when closed, otherwise live.
  const summaries: MonthSummary[] = keys.map((key) => {
    const st = states.get(key);
    if (st?.state.status === "CLOSED" && st.snapshot) return { monthKey: key, label: monthLabel(key), status: "CLOSED", figures: st.snapshot.figures };
    const { sales, orders, expenses } = sliceMonth(src, key, includeTest);
    return { monthKey: key, label: monthLabel(key), status: "OPEN", figures: computeMonth(key, sales, orders, expenses) };
  });

  const isLifetime = selection === "lifetime" || !keys.includes(selection);
  const sel = isLifetime ? "lifetime" : selection;
  const figures = isLifetime ? sumMonths(summaries.map((m) => m.figures)) : summaries.find((m) => m.monthKey === sel)!.figures;
  const stEntry = isLifetime ? undefined : states.get(sel);
  const locked = !!stEntry && stEntry.state.status === "CLOSED" && !!stEntry.snapshot;

  let drift = false;
  if (locked && stEntry?.snapshot) {
    const snap = stEntry.snapshot;
    const live = sliceMonth(src, sel, snap.includeTest);
    const liveFig = computeMonth(sel, live.sales, live.orders, live.expenses);
    drift = FIGURE_KEYS_TO_COMPARE.some((k) => liveFig[k] !== snap.figures[k]);
  }

  const range = isLifetime ? null : monthBounds(sel);
  const within = (d: Date | null) => !!d && (!range || (d >= range.start && d < range.end));

  const expenses = (isLifetime ? src.expenses : src.expenses.filter((e) => e.monthKey === sel)).slice().sort((a, b) => (a.date < b.date ? 1 : -1));

  let payouts: PayoutDisplay[];
  let payoutsPaidTotal: number;
  let owedRows: OwedRow[];
  let owed: OwedTotals;
  if (locked && stEntry?.snapshot) {
    payouts = stEntry.snapshot.payouts;
    payoutsPaidTotal = stEntry.snapshot.payoutsPaidTotal;
    owedRows = stEntry.snapshot.owedRows;
    owed = stEntry.snapshot.owed;
  } else {
    const paid = src.payouts.filter((p) => p.status === "PAID" && within(p.resolvedAt));
    payouts = paid.map(toPayoutDisplay).sort((a, b) => (a.date < b.date ? 1 : -1));
    payoutsPaidTotal = dollars(paid.reduce((s, p) => s + cents(p.amount), 0));
    const asOf = !range || range.end > now ? now : range.end;
    owedRows = computeOwed(src.earnings, src.payouts, asOf, minimum);
    owed = totalOwed(owedRows);
  }

  const luluRows = src.lulu.filter((r) => (isLifetime || inMonth(r.createdAt, sel)) && (includeTest || !r.isTest)).slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const luluMonthly = keys
    .map((k) => ({ monthKey: k, label: monthLabel(k), rows: src.lulu.filter((r) => inMonth(r.createdAt, k) && (includeTest || !r.isTest)) }))
    .filter((m) => m.rows.length > 0)
    .map((m) => ({ monthKey: m.monthKey, label: m.label, totals: luluTotalsFor(m.rows) }))
    .reverse();

  const logs = await prisma.accountingChangeLog.findMany({
    where: isLifetime ? {} : { monthKey: sel },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const chartEnd = isLifetime ? keys.length - 1 : keys.indexOf(sel);
  const chartMonths = summaries.slice(Math.max(0, chartEnd - 11), chartEnd + 1);

  return {
    selection: sel,
    selectionLabel: isLifetime ? "Lifetime" : monthLabel(sel),
    includeTest,
    testOrders: new Set(src.orders.filter((o) => o.isTest).map((o) => o.orderId)).size,
    liveOrders: new Set(src.orders.filter((o) => !o.isTest).map((o) => o.orderId)).size,
    months: summaries,
    years: [...new Set(keys.map((k) => Number(k.slice(0, 4))))].sort((a, b) => b - a),
    currentMonthKey,
    figures,
    state: stEntry?.state ?? null,
    locked,
    drift,
    expenses,
    payouts,
    payoutsPaidTotal,
    owed,
    owedRows,
    minimumPayout: minimum,
    lulu: luluRows.map(toLuluDisplay),
    luluTotals: luluTotalsFor(luluRows),
    luluMonthly,
    companyBooksPublished: src.companyBooksPublished,
    companyAccountFound: src.companyAccountFound,
    changeLog: logs.map((l) => ({ id: l.id, monthKey: l.monthKey, action: l.action, actorName: l.actorName, summary: l.summary, details: l.details, createdAt: iso(l.createdAt) })),
    chartMonths,
  };
}

// ---------- Drill-down: the list of transactions behind a total ----------

export interface DrillRow {
  key: string;
  date: string;
  ref: string;
  description: string;
  /** Signed, in dollars. */
  amount: number;
  note?: string;
}

export interface Drill {
  metric: Metric;
  title: string;
  rows: DrillRow[];
  total: number;
  explain: string;
}

const METRIC_TITLES: Record<Metric, string> = {
  customersPaid: "What customers paid", companyGrossShare: "Company 30% share (before referral commissions)", referralCommissions: "Referral commissions paid out of the company share",
  salesRevenue: "Company sales revenue (step 1)", acctRoyalties: "Company author account: royalties", acctReferral: "Company author account: referral earnings",
  acctPromotion: "Company author account: promotion earnings", acctGross: "Company author account earnings, gross (step 2)", totalRevenue: "Total revenue (step 3)",
  georgeRoyalty: "Royalty to George Otieno (10% of total revenue)", enteredExpenses: "Expenses entered by the admin", authorTax: "Tax on the author account (5% of its earnings)",
  profit: "Profit", incomeTax: "Income tax (30% of profit)", retained: "Retained after income tax", authorRoyalties: "Author royalties (all authors)",
  referralEarnings: "Referral earnings (all affiliates)", promotionCommissions: "Promotion commissions (all affiliates)", luluPrinting: "Lulu printing cost (pass-through)",
  luluShipping: "Lulu shipping (pass-through)", luluFulfillment: "Lulu fulfillment fee (pass-through)",
};

const SALE_METRICS: Metric[] = ["companyGrossShare", "referralCommissions", "salesRevenue", "acctRoyalties", "acctReferral", "acctPromotion", "acctGross", "authorRoyalties", "referralEarnings", "promotionCommissions", "luluPrinting"];
const ORDER_METRICS: Metric[] = ["customersPaid", "luluShipping", "luluFulfillment"];

function saleDesc(s: SaleRow): string {
  return `${s.bookTitle} (${s.format})`;
}

export async function buildDrill(selection: string, metric: Metric, includeTest: boolean): Promise<Drill> {
  const [src, states] = await Promise.all([loadAccountingSource(), loadMonthStates()]);
  const isLifetime = selection === "lifetime";
  // A closed month is explained with the same test-money switch it was closed with.
  const closedSnap = !isLifetime ? states.get(selection)?.snapshot : null;
  const useTest = closedSnap ? closedSnap.includeTest : includeTest;
  const keep = (d: Date, test: boolean) => (isLifetime || inMonth(d, selection)) && (useTest || !test);
  const sales = src.sales.filter((s) => keep(s.createdAt, s.isTest));
  const orders = src.orders.filter((o) => keep(o.createdAt, o.isTest));
  const expenses = src.expenses.filter((e) => isLifetime || e.monthKey === selection);
  const title = METRIC_TITLES[metric];
  const rows: DrillRow[] = [];
  /** The figures the page shows: each month on its own (the saved snapshot when closed), summed for lifetime. */
  const monthlyFigures = (): MonthCents => {
    const keys = isLifetime ? activeMonthKeys(src, states.keys()) : [selection];
    return sumMonths(
      keys.map((k) => {
        const snap = states.get(k)?.snapshot;
        if (snap) return snap.figures;
        return computeMonth(k, sales.filter((x) => inMonth(x.createdAt, k)), orders.filter((o) => inMonth(o.createdAt, k)), expenses.filter((e) => e.monthKey === k));
      })
    );
  };
  let explain = "";

  const pushSales = (m: Metric, sign = 1, prefix = "") => {
    for (const s of sales) {
      const c = lineContribution(s, m);
      if (c !== 0) rows.push({ key: `${prefix}${s.lineId}`, date: iso(s.createdAt), ref: `#${s.orderRef}`, description: saleDesc(s), amount: (sign * c) / 100, note: s.isTest ? "test money" : undefined });
    }
  };
  const pushExpenses = (prefix = "") => {
    for (const e of expenses) rows.push({ key: `${prefix}${e.id}`, date: `${e.date}T00:00:00.000Z`, ref: e.category, description: e.description, amount: -cents(e.amount) / 100 });
  };

  if (SALE_METRICS.includes(metric)) {
    pushSales(metric);
    explain = "Each row is one sold book. The total at the bottom is the figure you clicked.";
  } else if (ORDER_METRICS.includes(metric)) {
    for (const o of orders) {
      const c = orderContribution(o, metric);
      if (c !== 0 || metric === "customersPaid") rows.push({ key: o.orderId, date: iso(o.createdAt), ref: `#${o.orderRef}`, description: "Order", amount: c / 100, note: o.isTest ? "test money" : undefined });
    }
    explain = "Each row is one paid order.";
  } else if (metric === "enteredExpenses") {
    for (const e of expenses) rows.push({ key: e.id, date: `${e.date}T00:00:00.000Z`, ref: e.category, description: e.description, amount: cents(e.amount) / 100 });
    explain = "Each row is one expense an admin entered.";
  } else if (metric === "totalRevenue" || metric === "georgeRoyalty") {
    pushSales("salesRevenue", 1, "s-");
    pushSales("acctGross", 1, "a-");
    explain = metric === "totalRevenue"
      ? "Company sales revenue lines (after referral commissions) plus the company author account's gross earnings."
      : "The royalty is 10% of the total revenue, which is the sum of these lines (shown as the total below). The royalty itself is 10% of that.";
  } else if (metric === "authorTax") {
    pushSales("acctGross");
    explain = "The tax is 5% of the company author account's gross earnings, which are the lines below.";
  } else if (metric === "profit" || metric === "incomeTax" || metric === "retained") {
    const m = monthlyFigures();
    rows.push({ key: "rev", date: "", ref: "Step 3", description: "Total revenue (click Total revenue for its lines)", amount: dollars(m.totalRevenue) });
    rows.push({ key: "roy", date: "", ref: "Step 4", description: "Royalty to George Otieno (10%)", amount: -dollars(m.georgeRoyalty) });
    for (const e of expenses) rows.push({ key: e.id, date: `${e.date}T00:00:00.000Z`, ref: e.category, description: e.description, amount: -cents(e.amount) / 100 });
    rows.push({ key: "atx", date: "", ref: "Step 6", description: "Tax on the author account (5%)", amount: -dollars(m.authorTax) });
    explain = metric === "profit" ? "Profit is the sum of these lines." : metric === "incomeTax" ? "Income tax is 30% of the profit shown here when it is above zero (for a lifetime view, the sum of each month's tax)." : "Retained is profit minus income tax.";
  } else {
    pushExpenses();
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  const m = monthlyFigures();
  const total = dollars((m as unknown as Record<string, number>)[metric] ?? 0);
  return { metric, title, rows: rows.slice(0, 2000), total, explain };
}

export { nextMonthKey };
