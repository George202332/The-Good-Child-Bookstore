"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { BACKEND_ROLES, canViewFinancials } from "@/lib/roles";

/**
 * A unified transaction ledger for the admin backend — every order
 * (money coming in) and every payout (money going out) in one table,
 * so a single screen shows the platform's full financial activity
 * rather than orders and payouts living on separate pages with no
 * combined view. 7 columns: ID, Date, Type, Party, Method, Amount,
 * Status.
 */

export interface TransactionRow {
  id: string;
  date: string;
  type: "Sale" | "Payout";
  party: string;
  method: string;
  amount: number;
  status: string;
}

export async function getTransactionLedger(): Promise<TransactionRow[]> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !BACKEND_ROLES.includes(role) || !canViewFinancials(role)) return [];

  try {
    const [orders, payouts] = await Promise.all([
      prisma.order.findMany({
        include: { reader: { include: { user: true } }, paymentLogs: true },
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
      prisma.payoutRequest.findMany({
        include: { user: true },
        orderBy: { requestedAt: "desc" },
        take: 150,
      }),
    ]);

    const saleRows: TransactionRow[] = (orders as {
      id: string;
      createdAt: Date;
      totalAmount: unknown;
      status: string;
      reader: { user: { name: string } };
      paymentLogs: { gateway: string }[];
    }[]).map((o) => ({
      id: o.id,
      date: o.createdAt.toISOString(),
      type: "Sale",
      party: o.reader.user.name,
      method: o.paymentLogs[0]?.gateway ?? "Demo",
      amount: Number(o.totalAmount),
      status: o.status,
    }));

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
      method: "Wise",
      amount: Number(p.amount),
      status: p.status,
    }));

    return [...saleRows, ...payoutRows].sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}
