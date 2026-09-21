"use server";

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
  affiliateInfo: string;
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
        affiliateInfo: isAffiliateSale
          ? `${s.affiliateLink!.affiliate.user.name} — $${Number(s.affiliateShare).toFixed(2)}`
          : "—",
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
      affiliateInfo: "—",
      status: p.status,
    }));

    return [...saleRows, ...payoutRows].sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}

/**
 * Permanently deletes a single transaction — Admin only. Works for
 * both a sale ("Organic Sale"/"Affiliate Sale", backed by SaleLine)
 * and a payout (backed by PayoutRequest), real or test. Deliberately
 * no sales-history or transaction-existence block here — this is a
 * direct, explicit per-transaction delete, not the bulk test-data
 * cleanup flow, and the whole point is that it must work on real
 * transactions too. Deleting the SaleLine row removes its royalty and
 * commission shares in the same action, since companyShare/
 * authorShare/affiliateShare/authorReferralShare are columns on that
 * same row, not separate records — there's nothing left over to clean
 * up afterward. The same row is what both the admin ledger and an
 * author's own Transactions view read from, so removing it here
 * removes it from both at once, automatically.
 */
export async function deleteTransaction(id: string, type: "sale" | "payout"): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can delete a transaction." };

  try {
    if (type === "sale") {
      await prisma.saleLine.delete({ where: { id } });
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

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't delete this transaction." };
  }
}
