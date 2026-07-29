import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface ReferredAuthorRow {
  name: string;
  country: string | null;
  gender: string | null;
  booksPublished: number;
  companyRevenue: number;
  commission: number;
}

/** For the signed-in affiliate: every author they've referred onto the
 * platform, with real per-author totals — not just the summary numbers
 * shown in the 4 stat cards above the table. */
export async function getReferredAuthorsDetail(): Promise<ReferredAuthorRow[]> {
  const session = await auth();
  if (!session?.user) return [];

  const affiliateProfile = await prisma.affiliateProfile.findUnique({ where: { userId: session.user.id } });
  if (!affiliateProfile) return [];

  const referredAuthors = await prisma.authorProfile.findMany({
    where: { referredById: affiliateProfile.id },
    include: {
      user: true,
      books: { include: { saleLines: true } },
    },
  });

  return (referredAuthors as {
    user: { name: string };
    country: string | null;
    gender: string | null;
    books: { status: string; saleLines: { companyShare: unknown; authorReferralShare: unknown }[] }[];
  }[]).map((a) => {
    const booksPublished = a.books.filter((b) => b.status === "PUBLISHED").length;
    let companyRevenue = 0, commission = 0;
    for (const b of a.books) {
      for (const l of b.saleLines) {
        commission += Number(l.authorReferralShare);
        companyRevenue += Number(l.companyShare) + Number(l.authorReferralShare);
      }
    }
    return { name: a.user.name, country: a.country, gender: a.gender, booksPublished, companyRevenue, commission };
  });
}
