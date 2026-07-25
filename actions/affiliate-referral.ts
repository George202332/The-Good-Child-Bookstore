"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/** Records that someone is visiting the author signup page via an
 * affiliate's referral link (?ref=<affiliate's own referralCode>) — sets
 * a cookie that registerUser() reads if they actually sign up as an
 * author, attributing the new author to that affiliate for the
 * lifetime 3% referral commission (see lib/revenue.ts). Distinct from
 * recordAffiliateClick() in actions/affiliate.ts, which tracks clicks on
 * a specific book's promotional link, not an author-recruitment link. */
export async function recordAuthorReferralVisit(code: string): Promise<void> {
  const referrer = await prisma.affiliateProfile.findUnique({ where: { referralCode: code } });
  if (!referrer) return;

  const cookieStore = await cookies();
  cookieStore.set("gcb_author_ref", code, {
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
}
