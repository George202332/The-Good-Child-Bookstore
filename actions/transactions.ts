"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";
import { BACKEND_ROLES, canViewFinancials } from "@/lib/roles";

/**
 * A unified transaction ledger for the admin backend — every individual
 * book sale (one row per SaleLine, not per order, so a mixed-item order
 * doesn't hide which specific book earned an affiliate commission) and
 * every payout, in one table. 7 columns: ID, Date, Type, Party, Detail,
 * Amount, Affiliate Commission — the last column exists specifically so
 * an admin can see, for any sale, whether it was attributed to an
 * affiliate and exactly how much they earned, without cross-referencing
 * anything else. This replaces the earlier one-row-per-order version,
 * which had no visibility into affiliate attribution at all.
 */

export interface TransactionRow {
  id: string;
  date: string;
  type: "Organic Sale" | "Affiliate Sale" | "Payout";
  party: string;
  detail: string;
  amount: number;
  /** The company's revenue cut on this row, or null when the column
   * doesn't apply (a Payout row isn't a split sale — its whole amount
   * is already shown in `amount`). */
  companyShare: number | null;
  /** What the author earned on this row (the "Royalty" column), or
   * null when not applicable. */
  authorShare: number | null;
  /** What the affiliate earned on this row (the "Commission" column),
   * or null when not applicable. */
  affiliateShare: number | null;
  affiliateName: string | null;
  status: string;
}

export async function getTransactionLedger(): Promise<TransactionRow[]> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !BACKEND_ROLES.includes(role) || !canViewFinancials(role)) return [];

  try {
    const [saleLines, payouts] = await Promise.all([
      prisma.saleLine.findMany({
        include: {
          book: true,
          order: { include: { reader: { include: { user: true } } } },
          affiliateLink: { include: { affiliate: { include: { user: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.payoutRequest.findMany({
        include: { user: true },
        orderBy: { requestedAt: "desc" },
        take: 150,
      }),
    ]);

    type SaleLineRow = {
      id: string;
      createdAt: Date;
      saleType: string;
      grossAmount: unknown;
      companyShare: unknown;
      authorShare: unknown;
      affiliateShare: unknown;
      book: { title: string };
      order: { status: string; reader: { user: { name: string } } };
      affiliateLink: { affiliate: { user: { name: string } } } | null;
    };

    const saleRows: TransactionRow[] = (saleLines as SaleLineRow[]).map((s) => {
      const isAffiliateSale = Number(s.affiliateShare) > 0 && !!s.affiliateLink;
      return {
        id: s.id,
        date: s.createdAt.toISOString(),
        type: isAffiliateSale ? "Affiliate Sale" : "Organic Sale",
        party: s.order.reader.user.name,
        detail: s.book.title,
        amount: Number(s.grossAmount),
        companyShare: Number(s.companyShare),
        authorShare: Number(s.authorShare),
        affiliateShare: Number(s.affiliateShare),
        affiliateName: isAffiliateSale ? s.affiliateLink!.affiliate.user.name : null,
        status: s.order.status,
      };
    });

    const payoutRows: TransactionRow[] = (payouts as {
      id: string;
      requestedAt: Date;
      amount: unknown;
      status: string;
      user: { name: string };
    }[]).map((p) => ({
      id: p.id,
      date: p.requestedAt.toISOString(),
      type: "Payout",
      party: p.user.name,
      detail: "Wise payout",
      amount: Number(p.amount),
      companyShare: null,
      authorShare: null,
      affiliateShare: null,
      affiliateName: null,
      status: p.status,
    }));

    return [...saleRows, ...payoutRows].sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}

export interface TransactionDetail {
  id: string;
  kind: "sale" | "payout";
  type: string;
  date: string;
  status: string;
  amount: number;
  party: string;
  partyEmail: string;
  // Sale-only fields.
  bookTitle?: string;
  saleType?: string;
  format?: string | null;
  orderId?: string;
  companyShare?: number;
  authorShare?: number;
  affiliateShare?: number;
  authorReferralShare?: number;
  affiliateName?: string | null;
  // Payout-only fields.
  currency?: string;
  earningsType?: string;
  gateway?: string | null;
  wiseTransferId?: string | null;
  failureReason?: string | null;
  requestedAt?: string;
  resolvedAt?: string | null;
}

/**
 * Everything about one transaction that doesn't fit in the ledger's
 * table row — read on demand when an admin clicks a row (same pop-up
 * pattern as the Users table's getUserDetail), with a Cancel button up
 * top instead of routing through a separate page.
 */
export async function getTransactionDetail(id: string, type: "sale" | "payout"): Promise<TransactionDetail | null> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !BACKEND_ROLES.includes(role) || !canViewFinancials(role)) return null;

  try {
    if (type === "sale") {
      const line = await prisma.saleLine.findUnique({
        where: { id },
        include: {
          book: true,
          order: { include: { reader: { include: { user: true } } } },
          affiliateLink: { include: { affiliate: { include: { user: true } } } },
        },
      });
      if (!line) return null;
      return {
        id: line.id,
        kind: "sale",
        type: Number(line.affiliateShare) > 0 && line.affiliateLink ? "Affiliate Sale" : "Organic Sale",
        date: line.createdAt.toISOString(),
        status: line.order.status,
        amount: Number(line.grossAmount),
        party: line.order.reader.user.name,
        partyEmail: line.order.reader.user.email,
        bookTitle: line.book.title,
        saleType: line.saleType,
        format: line.format,
        orderId: line.orderId,
        companyShare: Number(line.companyShare),
        authorShare: Number(line.authorShare),
        affiliateShare: Number(line.affiliateShare),
        authorReferralShare: Number(line.authorReferralShare),
        affiliateName: line.affiliateLink?.affiliate?.user?.name ?? null,
      };
    }

    const payout = await prisma.payoutRequest.findUnique({ where: { id }, include: { user: true } });
    if (!payout) return null;
    return {
      id: payout.id,
      kind: "payout",
      type: "Payout",
      date: payout.requestedAt.toISOString(),
      status: payout.status,
      amount: Number(payout.amount),
      party: payout.user.name,
      partyEmail: payout.user.email,
      currency: payout.currency,
      earningsType: payout.earningsType,
      wiseTransferId: payout.wiseTransferId,
      failureReason: payout.failureReason,
      requestedAt: payout.requestedAt.toISOString(),
      resolvedAt: payout.resolvedAt ? payout.resolvedAt.toISOString() : null,
    };
  } catch {
    return null;
  }
}

/**
 * Permanently deletes a single transaction — Admin only. Works for
 * both a sale ("Organic Sale"/"Affiliate Sale", backed by SaleLine)
 * and a payout (backed by PayoutRequest), real or test.
 *
 * "Completely removed everywhere, with no trace left" means more than
 * deleting the SaleLine/PayoutRequest row itself:
 *
 * - Any Notification generated from this specific record (a "You've
 *   got a sale" for a SaleLine, or a "Payout sent"/"Payout rejected"
 *   for a PayoutRequest) is deleted too, via the loose relatedRecordId
 *   reference set when that notification was created (see
 *   lib/payments/finalize.ts and the createNotification call sites in
 *   actions/admin.ts / app/api/webhooks/wise/route.ts). Without this,
 *   the author's or reader's Recent Activity would still show a
 *   notification about a "sale" or "payout" that no longer exists.
 * - For a sale specifically, deleting the SaleLine can leave its
 *   parent Order empty (if it was the only line) or with a stale
 *   totalAmount (if other lines remain). An empty Order is deleted
 *   outright (cascading its PaymentLog/Invoice rows); an Order with
 *   remaining lines gets totalAmount recomputed from what's left, so
 *   nothing about the deleted line lingers in the reader's own Orders
 *   view either.
 */
export async function deleteTransaction(id: string, type: "sale" | "payout"): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can delete a transaction." };

  try {
    await prisma.notification.deleteMany({ where: { relatedRecordId: id } });

    if (type === "sale") {
      const line = await prisma.saleLine.findUnique({ where: { id }, select: { orderId: true } });
      if (!line) return { ok: false, error: "This transaction no longer exists." };

      await prisma.saleLine.delete({ where: { id } });

      const remaining = await prisma.saleLine.findMany({ where: { orderId: line.orderId }, select: { grossAmount: true } });
      if (remaining.length === 0) {
        // No lines left on this order at all — nothing left for the
        // reader to see, so remove the order itself rather than
        // leaving an empty $0.00 order behind.
        await prisma.order.delete({ where: { id: line.orderId } }).catch(() => {
          // If the order was already gone (or something still
          // references it), there's nothing more to clean up here.
        });
      } else {
        const newTotal = remaining.reduce((sum: number, l: { grossAmount: unknown }) => sum + Number(l.grossAmount), 0);
        await prisma.order.update({ where: { id: line.orderId }, data: { totalAmount: newTotal } });
      }
    } else {
      await prisma.payoutRequest.delete({ where: { id } });
    }

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "DELETE_TRANSACTION",
        metadata: { transactionId: id, transactionType: type, deletedAt: new Date().toISOString() },
      },
    });

    // The admin dashboard's "Total orders" card (and the analytics page)
    // read live counts on every request, but Next's client-side Router
    // Cache can still serve an already-visited page's last snapshot
    // instead of refetching — so without this, deleting a transaction
    // (or the order it belonged to) left "Total orders" showing its
    // pre-deletion figure until something else happened to force a
    // refetch. Revalidating every place that number (or the deleted
    // transaction itself) could still be showing makes sure the very
    // next visit to any of them is always freshly computed.
    revalidatePath("/admin");
    revalidatePath("/admin/analytics");
    revalidatePath("/admin/transactions");
    revalidatePath("/admin/payouts");
    revalidatePath("/account/orders");
    revalidatePath("/account/revenue");
    revalidatePath("/account/my-transactions");
    revalidatePath("/account/transaction-history");
    revalidatePath("/account/payout-settings");

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't delete this transaction." };
  }
}
