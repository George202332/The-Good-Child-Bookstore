"use server";

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { generateAccountNumber } from "@/lib/account-number";
import { generateUniqueReferralCode } from "@/lib/referral-code";

/**
 * Converted from doSignup() and handleReaderSignup()/handleAuthorSignup()/
 * handleAffiliateSignup() (the-good-child-bookstore_54_1.html:6364-6451).
 * The original stored accounts in localStorage with a hand-rolled
 * salt+hash; this creates a real User row (bcrypt-hashed password) plus
 * the matching role profile row. Only READER/AUTHOR/AFFILIATE are
 * reachable from these public signup forms — ADMIN/EDITOR accounts are
 * backend-only and are provisioned separately (see docs/architecture.md).
 */

export interface RegisterResult {
  ok: boolean;
  error?: string;
}

interface ReaderSignupInput {
  role: "READER";
  name: string;
  email: string;
  password: string;
}
interface AuthorSignupInput {
  role: "AUTHOR";
  name: string;
  penName?: string;
  email: string;
  genre: string;
  password: string;
}

export type SignupInput = ReaderSignupInput | AuthorSignupInput;

export async function registerUser(input: SignupInput): Promise<RegisterResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!email || !name || input.password.length < 6) {
    return { ok: false, error: "Please fill in every field (password must be at least 6 characters)." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const role: Role = input.role;
  const accountNumber = await generateAccountNumber(role);

  // If this author arrived via an affiliate's referral link (see
  // actions/affiliate-referral.ts), attribute the signup so that
  // affiliate earns a tiered (Hawk/Falcon/Eagle/Phoenix), for-life
  // author-referral commission on every future sale of this author's
  // books (see lib/revenue.ts applyAuthorReferralCarveOut and
  // lib/commission-settings.ts, applied in actions/orders.ts).
  let referredById: string | undefined;
  if (role === "AUTHOR") {
    try {
      const cookieStore = await cookies();
      const refCode = cookieStore.get("gcb_author_ref")?.value;
      if (refCode) {
        const referrer = await prisma.affiliateProfile.findUnique({ where: { referralCode: refCode } });
        if (referrer) referredById = referrer.id;
      }
    } catch {
      // No referral cookie, or it's stale/invalid — sign up without one.
    }
  }

  // Every Author and Affiliate gets their own unique referral code at
  // the point of registration — so an author can immediately start
  // referring other authors onto the platform from day one, not only
  // users who separately signed up as (or opted into being) an
  // Affiliate.
  const referralCode = role === "AUTHOR" ? await generateUniqueReferralCode(name) : undefined;

  await prisma.user.create({
    data: {
      accountNumber,
      email,
      name,
      passwordHash,
      role,
      ...(input.role === "READER" ? { readerProfile: { create: {} } } : {}),
      ...(input.role === "AUTHOR"
        ? {
            authorProfile: { create: { primaryGenre: input.genre, penName: input.penName?.trim() || null, referredById } },
            affiliateProfile: { create: { referralCode: referralCode! } },
          }
        : {}),
    },
  });

  return { ok: true };
}
