"use server";

import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";
import { fetchLuluPrintJob } from "@/lib/payments/lulu";
import {
  resolveRange, bucketFor, parsePrintJob, summarizeTotals, summarizePerformance,
  BUCKET_LABEL, type LuluOrderInput, type LuluTotals, type LuluPerformance, type StatusBucket,
} from "@/lib/lulu-report";

/** Everything on Admin > Lulu. Admin only: every function here checks the role on the server. */

export interface LuluOrderRow {
  orderId: string;
  orderNumber: string;
  date: string;
  books: string;
  formats: string;
  luluStatus: string;
  bucket: StatusBucket;
  bucketLabel: string;
  production: number | null;
  shipping: number | null;
  paidShipping: number;
  error: string | null;
  flagged: boolean;
}

export interface LuluReport {
  rangeLabel: string;
  from: string;
  to: string;
  totals: LuluTotals;
  performance: LuluPerformance;
  rows: LuluOrderRow[];
  lastSyncedAt: string | null;
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));

async function isAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === "ADMIN";
}

export async function getLuluReport(preset?: string, from?: string, to?: string): Promise<LuluReport | null> {
  if (!(await isAdmin())) return null;
  const range = resolveRange(preset, from, to);

  const orders = await prisma.order.findMany({
    where: {
      status: "PAID",
      createdAt: { gte: range.from, lt: range.to },
      lines: { some: { format: { in: ["paperback", "hardcover"] } } },
    },
    include: { lines: { include: { book: { select: { title: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const inputs: LuluOrderInput[] = [];
  const rows: LuluOrderRow[] = [];
  let lastSynced: Date | null = null;

  for (const o of orders) {
    const printLines = o.lines.filter((l: { format: string | null }) => l.format === "paperback" || l.format === "hardcover");
    const lineInputs = printLines.map((l: { grossAmount: unknown; printingCost: unknown }) => ({ paidBooks: Number(l.grossAmount), printingCost: num(l.printingCost) }));
    const savedProduction = lineInputs.reduce((s: number, l: { printingCost: number | null }) => s + (l.printingCost ?? 0), 0);
    const luluProduction = num(o.luluActualProduction) ?? (lineInputs.some((l: { printingCost: number | null }) => l.printingCost != null) ? savedProduction : null);
    const luluShipping = num(o.luluActualShipping) ?? num(o.luluShippingCost);
    const luluFulfillment = num(o.luluActualFulfillment) ?? num(o.luluFulfillmentCost);
    const input: LuluOrderInput = {
      orderId: o.id, createdAt: o.createdAt, printJobStatus: o.printJobStatus, luluStatus: o.luluStatus, luluShippedAt: o.luluShippedAt,
      shippingPaid: Number(o.shippingAmount ?? 0), luluProduction, luluShipping, luluFulfillment, lines: lineInputs,
    };
    inputs.push(input);
    if (o.luluSyncedAt && (!lastSynced || o.luluSyncedAt > lastSynced)) lastSynced = o.luluSyncedAt;
    const bucket = bucketFor(o.printJobStatus, o.luluStatus);
    rows.push({
      orderId: o.id,
      orderNumber: o.id.slice(-8).toUpperCase(),
      date: o.createdAt.toISOString(),
      books: printLines.map((l: { book: { title: string } }) => l.book.title).join(", "),
      formats: [...new Set(printLines.map((l: { format: string | null }) => (l.format === "hardcover" ? "Hardcover" : "Paperback")))].join(", "),
      luluStatus: o.luluStatus ?? (o.printJobStatus === "SUBMITTED" ? "Sent (not yet checked)" : o.printJobStatus === "FAILED" ? "Failed" : "Not sent"),
      bucket, bucketLabel: BUCKET_LABEL[bucket],
      production: luluProduction, shipping: luluShipping, paidShipping: Number(o.shippingAmount ?? 0),
      error: o.printJobError ?? null,
      flagged: bucket === "REJECTED" || bucket === "FAILED" || bucket === "NOT_SENT",
    });
  }

  return {
    rangeLabel: range.label,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    totals: summarizeTotals(inputs),
    performance: summarizePerformance(inputs),
    rows,
    lastSyncedAt: lastSynced ? lastSynced.toISOString() : null,
  };
}

/** Asks Lulu for the current status and charges of every sent print job in the range and saves them.
 * Only the Lulu status/charge columns are written; sales, royalties and customer amounts are untouched. */
export async function refreshFromLulu(preset?: string, from?: string, to?: string): Promise<{ ok: boolean; checked: number; updated: number; error?: string }> {
  if (!(await isAdmin())) return { ok: false, checked: 0, updated: 0, error: "Only Admins can do this." };
  const range = resolveRange(preset, from, to);
  const orders = await prisma.order.findMany({
    where: { status: "PAID", printJobId: { not: null }, createdAt: { gte: range.from, lt: range.to } },
    select: { id: true, printJobId: true },
    take: 200,
  });
  let updated = 0;
  let firstError: string | undefined;
  for (const o of orders as { id: string; printJobId: string | null }[]) {
    if (!o.printJobId) continue;
    const res = await fetchLuluPrintJob(o.printJobId);
    if (!res.ok) { firstError ??= res.error; continue; }
    const job = parsePrintJob(res.json);
    if (!job) { firstError ??= "Lulu's answer for a print job could not be read."; continue; }
    const shipped = job.status.toUpperCase() === "SHIPPED";
    await prisma.order.update({
      where: { id: o.id },
      data: {
        luluStatus: job.status,
        luluStatusAt: job.changedAt,
        ...(shipped && job.changedAt ? { luluShippedAt: job.changedAt } : {}),
        luluActualProduction: job.production,
        luluActualShipping: job.shipping,
        luluActualFulfillment: job.fulfillment,
        luluSyncedAt: new Date(),
      },
    });
    updated++;
  }
  return { ok: !firstError || updated > 0, checked: orders.length, updated, error: firstError };
}
