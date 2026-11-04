"use server";

import { saleModeLabel, payoutModeLabel } from "@/lib/payment-mode";
import { prisma } from "@/lib/prisma";
import { PAID_ONLY } from "@/lib/paid-sales";
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
  /** The Lulu shipping the customer paid on this printed order (charged once per order, so it
   * shows on the order's first printed item), or null (shown as a dash) for digital items. */
  shipping: number | null;
  /** Lulu's per-order fulfillment fee the customer paid, shown once per order next to Shipping (on the first printed
   * item); null (a dash) for digital items. A pass-through: never part of anyone's earnings. */
  fulfillment: number | null;
  status: string;
  /** How the money moved: Paystack, PayPal - Card, PayPal - Email, or the payout method. */
  mode: string;
}

export async function getTransactionLedger(): Promise<TransactionRow[]> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !BACKEND_ROLES.includes(role) || !canViewFinancials(role)) return [];

  try {
    const [saleLines, payouts] = await Promise.all([
      prisma.saleLine.findMany({
        // Only confirmed-paid sales are transactions; a pending or failed checkout is not.
        ...PAID_ONLY,
        include: {
          book: true,
          order: { include: { reader: { include: { user: true } }, paymentLogs: { orderBy: { createdAt: "desc" }, take: 1 }, lines: { select: { id: true, format: true, createdAt: true } } } },
          affiliateLink: { include: { affiliate: { include: { user: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.payoutRequest.findMany({
        include: { user: true, recipient: { select: { type: true } } },
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
      format: string | null;
      order: { status: string; shippingAmount: unknown; fulfillmentAmount: unknown; reader: { user: { name: string } }; paymentLogs: { gateway: string; rawPayload: unknown }[]; lines: { id: string; format: string | null; createdAt: Date }[] };
      affiliateLink: { affiliate: { user: { name: string } } } | null;
    };

    // Shipping is one charge for the whole order, so it is shown once: on the first printed item.
    const isPrint = (f: string | null) => f === "paperback" || f === "hardcover";
    const shippingShownOn = (s: SaleLineRow): number | null => {
      if (!isPrint(s.format) || s.order.shippingAmount == null) return null;
      const firstPrint = [...s.order.lines].filter((l) => isPrint(l.format)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))[0];
      return firstPrint && firstPrint.id === s.id ? Number(s.order.shippingAmount) : null;
    };

    const fulfillmentShownOn = (s: SaleLineRow): number | null => {
      if (!isPrint(s.format) || s.order.fulfillmentAmount == null) return null;
      const firstPrint = [...s.order.lines].filter((l) => isPrint(l.format)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))[0];
      return firstPrint && firstPrint.id === s.id ? Number(s.order.fulfillmentAmount) : null;
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
        shipping: shippingShownOn(s),
        fulfillment: fulfillmentShownOn(s),
        status: s.order.status,
        mode: saleModeLabel(s.order.paymentLogs[0]),
      };
    });

    const payoutRows: TransactionRow[] = (payouts as {
      id: string;
      requestedAt: Date;
      amount: unknown;
      status: string;
      user: { name: string };
      recipient: { type: string } | null;
    }[]).map((p) => ({
      id: p.id,
      date: p.requestedAt.toISOString(),
      type: "Payout",
      party: p.user.name,
      detail: "Payout",
      amount: Number(p.amount),
      companyShare: null,
      authorShare: null,
      affiliateShare: null,
      affiliateName: null,
      shipping: null,
      fulfillment: null,
      status: p.status,
      mode: payoutModeLabel(p.recipient?.type),
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
  mode: string;
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
  /** Printed items only: Lulu's production printing cost for this line, and the order's shipping. */
  printingCost?: number | null;
  shipping?: number | null;
  fulfillment?: number | null;
  // Payout-only fields.
  currency?: string;
  earningsType?: string;
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
const isPrint = (f: string | null) => f === "paperback" || f === "hardcover";

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
          order: { include: { reader: { include: { user: true } }, paymentLogs: { orderBy: { createdAt: "desc" }, take: 1 } } },
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
        mode: saleModeLabel(line.order.paymentLogs[0]),
        bookTitle: line.book.title,
        saleType: line.saleType,
        format: line.format,
        orderId: line.orderId,
        companyShare: Number(line.companyShare),
        authorShare: Number(line.authorShare),
        affiliateShare: Number(line.affiliateShare),
        authorReferralShare: Number(line.authorReferralShare),
        affiliateName: line.affiliateLink?.affiliate?.user?.name ?? null,
        printingCost: line.printingCost != null ? Number(line.printingCost) : null,
        shipping: isPrint(line.format) && line.order.shippingAmount != null ? Number(line.order.shippingAmount) : null,
        fulfillment: isPrint(line.format) && line.order.fulfillmentAmount != null ? Number(line.order.fulfillmentAmount) : null,
      };
    }

    const payout = await prisma.payoutRequest.findUnique({ where: { id }, include: { user: true, recipient: { select: { type: true } } } });
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
      mode: payoutModeLabel(payout.recipient?.type),
      currency: payout.currency,
      earningsType: payout.earningsType,
      failureReason: payout.failureReason,
      requestedAt: payout.requestedAt.toISOString(),
      resolvedAt: payout.resolvedAt ? payout.resolvedAt.toISOString() : null,
    };
  } catch {
    return null;
  }
}

// Deleting transactions and resetting all orders were removed on purpose. After launch no payment, order, refund or
// payout is ever deleted: a problem is recorded as its own entry (see actions/records.ts and lib/records.ts) and the
// database itself refuses to delete these rows (migration 20261106090000_records_never_deleted).
