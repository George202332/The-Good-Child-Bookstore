import { prisma } from "@/lib/prisma";
import { generateUniqueReferralCode } from "@/lib/referral-code";

/**
 * Whether a user has affiliate capability — true for every Reader and
 * Author account, automatically, from the moment it's created (see
 * actions/auth.ts registerUser, which creates an AffiliateProfile for
 * both roles at signup) — no manual "activate affiliate program" step
 * any more, per explicit instruction. The signal that actually matters
 * is having an AffiliateProfile row, not the primary role.
 *
 * Self-healing for any account created before this change (when only
 * Authors got one automatically, and a Reader had to opt in from
 * Settings): lazily creates the missing AffiliateProfile the first time
 * this is checked, rather than requiring a one-off data migration.
 */
export async function hasAffiliateCapability(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { affiliateProfile: true } });
    if (!user) return false;
    if (user.role !== "READER" && user.role !== "AUTHOR") return !!user.affiliateProfile;

    if (!user.affiliateProfile) {
      await prisma.affiliateProfile.create({
        data: { userId, referralCode: await generateUniqueReferralCode(user.name) },
      });
    }
    return true;
  } catch {
    return false;
  }
}
