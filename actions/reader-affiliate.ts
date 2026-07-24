"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Converted from enableReaderAffiliateAccess() (the-good-child-bookstore
 * _54_1.html accountHTML() reader branch) — a Reader (or Author) can
 * enable affiliate capability directly from their own dashboard, no
 * separate account or role change needed. This grants a real
 * AffiliateProfile (referral links, earnings, payouts all work exactly
 * like a dedicated Affiliate account) while the user's primary role and
 * all their existing reader data stays untouched.
 */

function generateReferralCode(name: string): string {
  const base = name.trim().split(" ")[0]?.toUpperCase().replace(/[^A-Z]/g, "") || "AFF";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

export async function enableReaderAffiliateAccess(): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user || (session.user.role !== "READER" && session.user.role !== "AUTHOR")) {
    return { ok: false, error: "Only reader or author accounts can enable affiliate access this way." };
  }

  const existing = await prisma.affiliateProfile.findUnique({ where: { userId: session.user.id } });
  if (existing) return { ok: true };

  await prisma.affiliateProfile.create({
    data: { userId: session.user.id, referralCode: generateReferralCode(session.user.name ?? "member") },
  });

  const readerProfile = await prisma.readerProfile.findUnique({ where: { userId: session.user.id } });
  if (readerProfile) {
    await prisma.readerProfile.update({ where: { userId: session.user.id }, data: { affiliateAccess: true } });
  }

  revalidatePath("/account");
  return { ok: true };
}

export interface ReaderAffiliateStatus {
  enabled: boolean;
  totalEarnings: number;
}

export async function getReaderAffiliateStatus(): Promise<ReaderAffiliateStatus> {
  const session = await auth();
  if (!session?.user) return { enabled: false, totalEarnings: 0 };

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { affiliateProfile: { include: { affiliateLinks: { include: { saleLines: true } } } } },
    });
    if (!user?.affiliateProfile) return { enabled: false, totalEarnings: 0 };

    const totalEarnings = user.affiliateProfile.affiliateLinks
      .flatMap((l: { saleLines: { affiliateShare: unknown }[] }) => l.saleLines)
      .reduce((sum: number, s: { affiliateShare: unknown }) => sum + Number(s.affiliateShare), 0);

    return { enabled: true, totalEarnings };
  } catch {
    return { enabled: false, totalEarnings: 0 };
  }
}
