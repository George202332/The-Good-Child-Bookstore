import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { fullAccountName } from "@/lib/full-name";
import { maskAccountNumber } from "@/lib/mask-account-number";
import { PAID_ONLY } from "@/lib/paid-sales";

export interface ReferredAuthorRow {
  maskedAccountId: string;
  /** The referred account's full name. */
  fullName: string;
  country: string | null;
  published: number;
  company: number;
  commission: number;
}

/** For the signed-in affiliate: every author they've referred onto the
 * platform, with real per-author totals — not just the summary numbers
 * shown in the 4 stat cards above the table. The referred account's full
 * name is shown; the account ID still has its middle digits masked. */
export async function getReferredAuthorsDetail(): Promise<ReferredAuthorRow[]> {
  const session = await auth();
  if (!session?.user) return [];

  const affiliateProfile = await prisma.affiliateProfile.findUnique({ where: { userId: session.user.id } });
  if (!affiliateProfile) return [];

  const referredAuthors = await prisma.authorProfile.findMany({
    where: { referredById: affiliateProfile.id },
    include: {
      user: true,
      books: { include: { saleLines: PAID_ONLY } },
    },
  });

  return (referredAuthors as {
    user: { name: string; accountNumber: string };
    country: string | null;
    books: { status: string; saleLines: { companyShare: unknown; authorReferralShare: unknown }[] }[];
  }[]).map((a) => {
    const published = a.books.filter((b) => b.status === "PUBLISHED").length;
    let company = 0, commission = 0;
    for (const b of a.books) {
      for (const l of b.saleLines) {
        commission += Number(l.authorReferralShare);
        company += Number(l.companyShare) + Number(l.authorReferralShare);
      }
    }
    return {
      maskedAccountId: maskAccountNumber(a.user.accountNumber),
      fullName: fullAccountName(a.user.name),
      country: a.country,
      published,
      company,
      commission,
    };
  });
}
