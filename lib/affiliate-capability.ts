import { prisma } from "@/lib/prisma";

/**
 * Whether a user has affiliate capability — true for anyone with role
 * AFFILIATE, but also true for a Reader (or Author) who's enabled it as
 * a bolt-on from their own dashboard (readerProfile.affiliateAccess,
 * see actions/reader-affiliate.ts), matching the original's real
 * behavior: "enableReaderAffiliateAccess()" grants affiliate features
 * without a separate account or role change. The signal that actually
 * matters is having an AffiliateProfile row, not the primary role.
 */
export async function hasAffiliateCapability(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { affiliateProfile: true } });
    return !!user?.affiliateProfile;
  } catch {
    return false;
  }
}
