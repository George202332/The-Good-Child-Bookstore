"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * A Reader's affiliate snapshot for the dashboard stat card — affiliate
 * capability is automatic for every Reader account from creation (see
 * lib/affiliate-capability.ts and actions/auth.ts), so there's no
 * manual activation step any more; this just reports the real numbers.
 */

export interface ReaderAffiliateStatus {
  enabled: boolean;
  totalEarnings: number;
}

export async function getReaderAffiliateStatus(): Promise<ReaderAffiliateStatus> {
  const session = await auth();
  if (!session?.user) return { enabled: false, totalEarnings: 0 };

  try {
    const { hasAffiliateCapability } = await import("@/lib/affiliate-capability");
    const enabled = await hasAffiliateCapability(session.user.id);
    if (!enabled) return { enabled: false, totalEarnings: 0 };

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { affiliateProfile: { include: { affiliateLinks: { include: { saleLines: true } } } } },
    });
    if (!user?.affiliateProfile) return { enabled: true, totalEarnings: 0 };

    const totalEarnings = user.affiliateProfile.affiliateLinks
      .flatMap((l: { saleLines: { affiliateShare: unknown }[] }) => l.saleLines)
      .reduce((sum: number, s: { affiliateShare: unknown }) => sum + Number(s.affiliateShare), 0);

    return { enabled: true, totalEarnings };
  } catch {
    return { enabled: false, totalEarnings: 0 };
  }
}
