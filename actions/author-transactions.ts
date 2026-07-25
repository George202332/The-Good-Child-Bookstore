"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** An author's own transaction history — every sale line on their
 * books plus their own payout requests, in one combined, chronological
 * list (matching the same 7-column shape as the admin ledger). */

export interface AuthorTransactionRow {
  id: string;
  date: string;
  type: "Sale" | "Payout";
  party: string;
  method: string;
  amount: number;
  status: string;
}

export async function getAuthorTransactions(): Promise<AuthorTransactionRow[]> {
  const session = await auth();
  if (session?.user?.role !== "AUTHOR") return [];

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { authorProfile: { include: { books: { include: { saleLines: { include: { book: true } } } } } } },
    });
    const books = user?.authorProfile?.books ?? [];
    const saleRows: AuthorTransactionRow[] = books.flatMap((b: { saleLines: { id: string; createdAt: Date; authorShare: unknown; book: { title: string }; saleType: string }[] }) =>
      b.saleLines.map((l) => ({
        id: l.id,
        date: l.createdAt.toISOString(),
        type: "Sale" as const,
        party: l.book.title,
        method: l.saleType,
        amount: Number(l.authorShare),
        status: "PAID",
      }))
    );

    const payouts = await prisma.payoutRequest.findMany({ where: { userId: session.user.id } });
    const payoutRows: AuthorTransactionRow[] = payouts.map((p: { id: string; requestedAt: Date; amount: unknown; status: string }) => ({
      id: p.id,
      date: p.requestedAt.toISOString(),
      type: "Payout" as const,
      party: "Wise payout",
      method: "Wise",
      amount: Number(p.amount),
      status: p.status,
    }));

    return [...saleRows, ...payoutRows].sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}
