"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface CommissionRow {
  id: string;
  date: string;
  bookTitle: string;
  saleAmount: number;
  commission: number;
}

/** Real per-sale commission breakdown — splitting "Commissions" out
 * from the combined Earnings page. */
export async function getMyCommissions(): Promise<CommissionRow[]> {
  const session = await auth();
  if (!session?.user) return [];

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { affiliateProfile: { include: { affiliateLinks: { include: { saleLines: { include: { book: true } } } } } } },
    });
    const links = user?.affiliateProfile?.affiliateLinks ?? [];
    const rows = links.flatMap((l: { saleLines: { id: string; createdAt: Date; grossAmount: unknown; affiliateShare: unknown; book: { title: string } }[] }) =>
      l.saleLines.map((s) => ({
        id: s.id,
        date: s.createdAt.toISOString(),
        bookTitle: s.book.title,
        saleAmount: Number(s.grossAmount),
        commission: Number(s.affiliateShare),
      }))
    );
    return rows.sort((a: { date: string }, b: { date: string }) => (a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}
