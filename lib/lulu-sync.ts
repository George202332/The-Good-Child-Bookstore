import { prisma } from "@/lib/prisma";
import { parsePrintJob } from "@/lib/lulu-report";
import { isRejectedStatus, reasonFromPrintJob } from "@/lib/lulu-rejection";
import { recordRejectionAndNotify } from "@/lib/lulu-rejection-notify";

/**
 * Applies what Lulu says about one print job (the JSON from GET /print-jobs/{id}) to our order:
 * its status, the shipped time, what Lulu charged, and, if Lulu rejected it, the rejection
 * (the author is told once). Used by the "Refresh From Lulu" button and by the Lulu webhook,
 * so they behave identically, and running it again for the same job changes nothing twice.
 * Only the Lulu status/charge columns are written; sales, royalties and customer amounts are untouched.
 */
export async function applyLuluJob(orderId: string, json: unknown): Promise<{ applied: boolean; notified: boolean }> {
  const job = parsePrintJob(json);
  if (!job) return { applied: false, notified: false };
  const shipped = job.status.toUpperCase() === "SHIPPED";
  const before = await prisma.order.findUnique({ where: { id: orderId }, select: { luluStatus: true } });
  await prisma.order.update({
    where: { id: orderId },
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
  if (before?.luluStatus !== job.status) {
    const { logRecordChange } = await import("@/lib/records");
    await logRecordChange({
      entityType: "LULU", entityId: orderId, action: "LULU_STATUS", summary: `Lulu status ${before?.luluStatus ?? "(none)"} -> ${job.status}`,
      before: { luluStatus: before?.luluStatus ?? null }, after: { luluStatus: job.status }, actorName: "Lulu (sync or webhook)",
    });
  }
  let notified = false;
  if (isRejectedStatus(job.status)) {
    notified = await recordRejectionAndNotify(orderId, reasonFromPrintJob(json) ?? "Lulu rejected this print job and did not say why.");
  }
  return { applied: true, notified };
}
