import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * Generates a referral code guaranteed unique against every existing
 * AffiliateProfile.referralCode — the previous version in 3 separate
 * files generated a name-prefix plus a short random suffix with no
 * actual collision check, relying on the database's unique constraint
 * to simply fail on a clash rather than retry. This checks first and
 * retries with a fresh code on the rare collision, and uses a longer,
 * cryptographically random suffix so a real clash is extremely
 * unlikely in the first place.
 */
export async function generateUniqueReferralCode(name: string): Promise<string> {
  const base = name.trim().split(" ")[0]?.toUpperCase().replace(/[^A-Z]/g, "") || "GCB";
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = crypto.randomBytes(5).toString("hex").toUpperCase();
    const code = `${base}-${suffix}`;
    const existing = await prisma.affiliateProfile.findUnique({ where: { referralCode: code } });
    if (!existing) return code;
  }
  // Astronomically unlikely to ever reach here (16^10 possibilities per
  // base name), but fall back to a fully random code with no base name
  // rather than loop forever.
  return `GCB-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}
