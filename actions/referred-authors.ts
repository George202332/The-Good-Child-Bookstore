import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { firstNameOnly } from "@/lib/first-name";
import { maskAccountNumber } from "@/lib/mask-account-number";

export interface ReferredAuthorRow {
  maskedAccountId: string;
  firstName: string;
  country: string | null;
  published: number;
  company: number;
  commission: number;
}

/** For the signed-in affiliate: every author they've referred onto the
 * platform, with real per-author totals — not just the summary numbers
 * shown in the 4 stat cards above the table. Anonymized for privacy:
 * first name only, and the account ID has its middle digits masked. */
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
      firstName: firstNameOnly(a.user.name),
      country: a.country,
      published,
      company,
      commission,
    };
  });
}
