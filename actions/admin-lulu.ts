"use server";

import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";
import { fetchLuluPrintJob, registerLuluWebhookUrl } from "@/lib/payments/lulu";
import { applyLuluJob } from "@/lib/lulu-sync";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import {
  resolveRange, bucketFor, summarizeTotals, summarizePerformance,
  BUCKET_LABEL, type LuluOrderInput, type LuluTotals, type LuluPerformance, type StatusBucket,
} from "@/lib/lulu-report";

/** Everything on Admin > Lulu. Admin only: every function here checks the role on the server. */

export interface LuluOrderRow {
  orderId: string;
  orderNumber: string;
  date: string;
  books: string;
  authors: string;
  customer: string;
  formats: string;
  luluStatus: string;
  bucket: StatusBucket;
  bucketLabel: string;
  production: number | null;
  shipping: number | null;
  paidShipping: number;
  error: string | null;
  flagged: boolean;
  /** "Rejected By Lulu", "Cancelled At Lulu", "Failed To Send" or "Not Sent Yet" on a row that needs attention. */
  problemLabel: string | null;
  /** The exact reason Lulu (or the file check) gave, in full. */
  reason: string | null;
  /** When the author(s) were told about a rejection. */
  authorNotifiedAt: string | null;
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

function problemLabelFor(bucket: StatusBucket, luluStatus: string | null, rejectionReason: string | null): string | null {
  if (bucket === "REJECTED") return (luluStatus ?? "").toUpperCase().startsWith("CANCEL") ? "Cancelled At Lulu" : "Rejected By Lulu";
  if (bucket === "FAILED") return rejectionReason ? "Rejected By Lulu" : "Failed To Send";
  if (bucket === "NOT_SENT") return "Not Sent Yet";
  return null;
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
    include: {
      reader: { include: { user: { select: { name: true } } } },
      lines: { include: { book: { select: { title: true, author: { select: { penName: true, user: { select: { name: true } } } } } } } },
    },
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
      authors: [...new Set(printLines.map((l: { book: { author: { penName: string | null; user: { name: string } } } }) => l.book.author.penName || l.book.author.user.name))].join(", "),
      customer: (o as unknown as { reader: { user: { name: string } } }).reader.user.name,
      formats: [...new Set(printLines.map((l: { format: string | null }) => (l.format === "hardcover" ? "Hardcover" : "Paperback")))].join(", "),
      luluStatus: o.luluStatus ?? (o.printJobStatus === "SUBMITTED" ? "Sent (not yet checked)" : o.printJobStatus === "FAILED" ? "Failed" : "Not sent"),
      bucket, bucketLabel: BUCKET_LABEL[bucket],
      production: luluProduction, shipping: luluShipping, paidShipping: Number(o.shippingAmount ?? 0),
      error: o.printJobError ?? null,
      flagged: bucket === "REJECTED" || bucket === "FAILED" || bucket === "NOT_SENT",
      problemLabel: problemLabelFor(bucket, o.luluStatus, o.luluRejectionReason),
      reason: o.luluRejectionReason ?? (bucket === "FAILED" || bucket === "REJECTED" ? o.printJobError : null) ?? null,
      authorNotifiedAt: o.luluAuthorNotifiedAt ? o.luluAuthorNotifiedAt.toISOString() : null,
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
    const applied = await applyLuluJob(o.id, res.json);
    if (!applied.applied) { firstError ??= "Lulu's answer for a print job could not be read."; continue; }
    updated++;
  }
  return { ok: !firstError || updated > 0, checked: orders.length, updated, error: firstError };
}


/** Asks Lulu to call this site whenever a print job's status changes (so rejections reach authors
 * straight away). Admin only. Needs Lulu to be connected in API Management first. */
export async function registerLuluWebhook(): Promise<{ ok: boolean; message: string }> {
  if (!(await isAdmin())) return { ok: false, message: "Only Admins can do this." };
  const url = `${getPublicSiteUrl().replace(/\/$/, "")}/api/webhooks/lulu`;
  const res = await registerLuluWebhookUrl(url);
  return res.ok ? { ok: true, message: `Lulu will now notify ${url} when a print job changes.` } : { ok: false, message: res.error };
}
