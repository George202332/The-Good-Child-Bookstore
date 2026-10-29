/**
 * The pure rules behind Admin > Lulu: date ranges, how Lulu's print job status is grouped,
 * what customers paid vs what Lulu charges, and fulfilment performance. No database or network
 * here, so all of it can be tested.
 */

export type RangePreset = "this-month" | "last-month" | "custom";

export interface DateRange {
  preset: RangePreset;
  from: Date; // inclusive
  to: Date; // exclusive
  label: string;
}

function startOfMonth(y: number, m: number): Date {
  return new Date(Date.UTC(y, m, 1));
}

function parseDay(v: string | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "This month", "last month" or a custom day range (both days included). */
export function resolveRange(preset: string | undefined, from: string | undefined, to: string | undefined, now: Date = new Date()): DateRange {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (preset === "custom") {
    const a = parseDay(from);
    const b = parseDay(to);
    if (a && b && a <= b) {
      return { preset: "custom", from: a, to: new Date(b.getTime() + 86_400_000), label: `${from} to ${to}` };
    }
  }
  if (preset === "last-month") {
    return { preset: "last-month", from: startOfMonth(y, m - 1), to: startOfMonth(y, m), label: "Last month" };
  }
  return { preset: "this-month", from: startOfMonth(y, m), to: startOfMonth(y, m + 1), label: "This month" };
}

/** The headline groups shown in the performance section. */
export type StatusBucket = "NOT_SENT" | "SUBMITTED" | "IN_PRODUCTION" | "SHIPPED" | "REJECTED" | "FAILED";

export const BUCKET_LABEL: Record<StatusBucket, string> = {
  NOT_SENT: "Not sent yet",
  SUBMITTED: "Submitted",
  IN_PRODUCTION: "In production",
  SHIPPED: "Shipped",
  REJECTED: "Rejected by Lulu",
  FAILED: "Failed to send",
};

/** Groups an order into a bucket from our own send status and Lulu's status (when known). */
export function bucketFor(printJobStatus: string | null | undefined, luluStatus: string | null | undefined): StatusBucket {
  const ours = (printJobStatus ?? "").toUpperCase();
  if (ours === "FAILED") return "FAILED";
  if (!ours || ours === "SUBMITTING") return "NOT_SENT";
  const l = (luluStatus ?? "").toUpperCase();
  if (l === "SHIPPED") return "SHIPPED";
  if (l === "IN_PRODUCTION") return "IN_PRODUCTION";
  if (l === "REJECTED" || l === "CANCELED" || l === "CANCELLED" || l === "ERROR") return "REJECTED";
  return "SUBMITTED"; // sent to Lulu; CREATED, UNPAID, PAYMENT_IN_PROGRESS, PRODUCTION_READY, PRODUCTION_DELAYED ...
}

export interface ParsedPrintJob {
  status: string;
  changedAt: Date | null;
  production: number | null;
  shipping: number | null;
  fulfillment: number | null;
}

function money(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** Reads Lulu's print job (GET /print-jobs/{id}/): its status and what it says it charged. */
export function parsePrintJob(json: unknown): ParsedPrintJob | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const st = o.status as { name?: unknown; changed?: unknown } | undefined;
  const status = typeof st?.name === "string" ? st.name : null;
  if (!status) return null;
  const changed = typeof st?.changed === "string" ? new Date(st.changed) : null;
  const costs = (o.costs ?? {}) as Record<string, unknown>;
  const lic = costs.line_item_costs;
  const items = Array.isArray(lic) ? lic : lic && typeof lic === "object" ? [lic] : [];
  let production: number | null = null;
  for (const it of items as Record<string, unknown>[]) {
    const c = money(it?.total_cost_excl_tax);
    if (c !== null) production = (production ?? 0) + c;
  }
  const shipping = money((costs.shipping_cost as Record<string, unknown> | undefined)?.total_cost_excl_tax);
  const fulfillment = money((costs.fulfillment_cost as Record<string, unknown> | undefined)?.total_cost_excl_tax);
  return {
    status,
    changedAt: changed && !Number.isNaN(changed.getTime()) ? changed : null,
    production: production === null ? null : Math.round(production * 100) / 100,
    shipping,
    fulfillment,
  };
}

export interface LuluLineInput {
  paidBooks: number; // book price paid for the line
  printingCost: number | null; // Lulu production cost saved on the line
}

export interface LuluOrderInput {
  orderId: string;
  createdAt: Date;
  printJobStatus: string | null;
  luluStatus: string | null;
  luluShippedAt: Date | null;
  shippingPaid: number; // what the customer paid for shipping
  /** What Lulu charges: the print job's own figures when synced, otherwise the quote saved at order time. */
  luluProduction: number | null;
  luluShipping: number | null;
  luluFulfillment: number | null;
  lines: LuluLineInput[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface LuluTotals {
  orders: number;
  /** (a) What customers paid on print orders. */
  paidBooks: number;
  paidProduction: number; // the part of the book price that covers Lulu's production printing
  paidShipping: number;
  /** (b) What Lulu charges the company. */
  luluProduction: number;
  luluShipping: number;
  luluFulfillment: number;
  luluTotal: number;
  /** Customers' production + shipping payments minus Lulu's production + shipping charges.
   * Zero means they match; the fulfilment fee is a separate company cost. */
  productionDifference: number;
  shippingDifference: number;
  totalDifference: number;
}

export function summarizeTotals(orders: LuluOrderInput[]): LuluTotals {
  let paidBooks = 0, paidProduction = 0, paidShipping = 0, lp = 0, ls = 0, lf = 0;
  for (const o of orders) {
    paidShipping += o.shippingPaid;
    for (const l of o.lines) {
      paidBooks += l.paidBooks;
      paidProduction += l.printingCost ?? 0;
    }
    lp += o.luluProduction ?? o.lines.reduce((s, l) => s + (l.printingCost ?? 0), 0);
    ls += o.luluShipping ?? 0;
    lf += o.luluFulfillment ?? 0;
  }
  const productionDifference = r2(paidProduction - lp);
  const shippingDifference = r2(paidShipping - ls);
  return {
    orders: orders.length,
    paidBooks: r2(paidBooks), paidProduction: r2(paidProduction), paidShipping: r2(paidShipping),
    luluProduction: r2(lp), luluShipping: r2(ls), luluFulfillment: r2(lf), luluTotal: r2(lp + ls + lf),
    productionDifference, shippingDifference, totalDifference: r2(productionDifference + shippingDifference),
  };
}

export interface LuluPerformance {
  counts: Record<StatusBucket, number>;
  /** Average days from the order being placed to Lulu shipping it; null when nothing has shipped. */
  avgDaysToShip: number | null;
  shippedCount: number;
  flagged: number;
}

export function summarizePerformance(orders: LuluOrderInput[]): LuluPerformance {
  const counts: Record<StatusBucket, number> = { NOT_SENT: 0, SUBMITTED: 0, IN_PRODUCTION: 0, SHIPPED: 0, REJECTED: 0, FAILED: 0 };
  let days = 0;
  let shipped = 0;
  for (const o of orders) {
    counts[bucketFor(o.printJobStatus, o.luluStatus)] += 1;
    if (o.luluShippedAt) {
      const d = (o.luluShippedAt.getTime() - o.createdAt.getTime()) / 86_400_000;
      if (d >= 0) { days += d; shipped += 1; }
    }
  }
  return {
    counts,
    avgDaysToShip: shipped > 0 ? Math.round((days / shipped) * 10) / 10 : null,
    shippedCount: shipped,
    flagged: counts.REJECTED + counts.FAILED + counts.NOT_SENT,
  };
}
