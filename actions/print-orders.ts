"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";
import { shippingLevelLabel } from "@/lib/lulu-order";

/**
 * Admin tools for print (paperback / hardcover) orders that have not
 * reached Lulu: lists paid orders whose print job was never sent, failed,
 * or is stuck, and lets an Admin send one again. Orders are normally sent
 * to Lulu automatically the moment payment is confirmed (see
 * lib/payments/lulu.ts); this is the safety net for the ones that did not
 * go through (including orders placed before the fix that made sending
 * reliable).
 */

export interface PrintOrderRow {
  id: string;
  shortId: string;
  createdAt: string;
  customer: string;
  items: string;
  status: string;
  error: string | null;
  isTest: boolean;
}

export async function listPrintOrdersNeedingAttention(): Promise<PrintOrderRow[]> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return [];

  const orders = await prisma.order.findMany({
    where: {
      status: "PAID",
      lines: { some: { format: { in: ["paperback", "hardcover"] } } },
      OR: [{ printJobStatus: null }, { printJobStatus: { not: "SUBMITTED" } }],
    },
    include: { reader: { include: { user: true } }, lines: { include: { book: { select: { title: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return orders.map((o) => ({
    id: o.id,
    shortId: o.id.slice(0, 8).toUpperCase(),
    createdAt: o.createdAt.toISOString(),
    customer: o.shipName || o.reader.user.name,
    items: o.lines
      .filter((l) => l.format === "paperback" || l.format === "hardcover")
      .map((l) => `${l.book.title} (${l.format})`)
      .join(", ") + ` — ${shippingLevelLabel(o.shippingLevel)}`,
    status: o.printJobStatus ?? "NOT SENT",
    error: o.printJobError,
    isTest: o.isTestData,
  }));
}

export async function resendPrintOrder(orderId: string): Promise<{ ok: boolean; message: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, message: "Only Admins can do this." };

  const { submitPrintJobsForOrder } = await import("@/lib/payments/lulu");
  const outcome = await submitPrintJobsForOrder(orderId, { resend: true });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "PRINT_ORDER_RESENT",
        metadata: { orderId, state: outcome.state, ok: outcome.ok, error: outcome.error ?? null },
      },
    });
  } catch {
    // Non-critical.
  }

  revalidatePath("/admin/transactions");
  revalidatePath("/account/orders");
  if (outcome.state === "submitted") return { ok: true, message: "Sent to Lulu." };
  if (outcome.state === "already") return { ok: true, message: "This order was already sent to Lulu." };
  if (outcome.state === "none") return { ok: true, message: "This order has no print copies." };
  return { ok: false, message: outcome.error ?? "Could not send this order to Lulu." };
}
