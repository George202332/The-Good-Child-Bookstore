"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** Real per-link performance (clicks, conversions, commission) —
 * splitting "Performance" out from the combined Earnings page, matching
 * the original sidebar's separate Performance section. */

export interface LinkPerformanceRow {
  id: string;
  code: string;
  bookTitle: string | null;
  clicks: number;
  conversions: number;
  commission: number;
}

export async function getMyLinkPerformance(): Promise<LinkPerformanceRow[]> {
  const session = await auth();
  if (!session?.user) return [];

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { affiliateProfile: { include: { affiliateLinks: { include: { book: true, clicks: true, saleLines: true } } } } },
    });
    const links = user?.affiliateProfile?.affiliateLinks ?? [];
    return links.map((l: { id: string; code: string; book: { title: string } | null; clicks: unknown[]; saleLines: { affiliateShare: unknown }[] }) => ({
      id: l.id,
      code: l.code,
      bookTitle: l.book?.title ?? null,
      clicks: l.clicks.length,
      conversions: l.saleLines.length,
      commission: l.saleLines.reduce((s: number, sl) => s + Number(sl.affiliateShare), 0),
    }));
  } catch {
    return [];
  }
}
