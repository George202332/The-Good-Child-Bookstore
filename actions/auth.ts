"use server";

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { generateAccountNumber } from "@/lib/account-number";
import { generateUniqueReferralCode } from "@/lib/referral-code";
import { getRequestIp } from "@/lib/geo";
import { isDisposableEmail } from "@/lib/disposable-email-domains";
import { verifyTurnstileToken } from "@/lib/turnstile";

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
  /** Hidden field real users never see or fill — see the signup forms
   * for the CSS that hides it. Non-empty means a bot filled every
   * field it could find; see the bot-defense block below. */
  honeypot?: string;
  /** Cloudflare Turnstile response token from TurnstileWidget — null/
   * undefined when Turnstile isn't configured (see lib/turnstile.ts),
   * in which case verification is skipped rather than blocking signup. */
  turnstileToken?: string | null;
}
interface AuthorSignupInput {
  role: "AUTHOR";
  name: string;
  penName?: string;
  email: string;
  genre: string;
  password: string;
  honeypot?: string;
  turnstileToken?: string | null;
}

export type SignupInput = ReaderSignupInput | AuthorSignupInput;

const SIGNUPS_PER_IP_PER_HOUR = 5;

export async function registerUser(input: SignupInput): Promise<RegisterResult> {
  // Honeypot: a hidden field no real visitor can see or fill. A bot
  // that blindly fills every form field trips it, and gets a
  // no-op "success" back — no error to learn from, no account created.
  if (input.honeypot) {
    return { ok: true };
  }

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!email || !name || input.password.length < 6) {
    return { ok: false, error: "Please fill in every field (password must be at least 6 characters)." };
  }

  if (isDisposableEmail(email)) {
    return { ok: false, error: "Please sign up with a permanent email address — temporary/disposable inboxes aren't accepted." };
  }

  // Per-IP rate limit: counts every attempt that got this far (past
  // the honeypot) in the last hour, successful or not, so a script
  // retrying with fresh emails from the same IP still gets throttled.
  const ip = (await getRequestIp()) ?? "unknown";
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentAttempts = await prisma.signupAttempt.count({ where: { ip, createdAt: { gte: oneHourAgo } } });
  if (recentAttempts >= SIGNUPS_PER_IP_PER_HOUR) {
    return { ok: false, error: "Too many signup attempts from this connection recently — please try again later." };
  }
  await prisma.signupAttempt.create({ data: { ip } });

  const turnstileOk = await verifyTurnstileToken(input.turnstileToken ?? null, ip === "unknown" ? null : ip);
  if (!turnstileOk) {
    return { ok: false, error: "Please complete the verification challenge and try again." };
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

  // Real IP-based geolocation (see lib/geo.ts) captured at the moment
  // of signup — used to show which country an author actually signed
  // up from (e.g. on the affiliate's "Authors you've referred" table).
  const { getRequestGeo } = await import("@/lib/geo");
  const signupGeo = await getRequestGeo();

  // When the site is in test mode, every new signup is automatically
  // flagged as test data — no manual marking needed.
  const { getSiteDataMode } = await import("@/actions/test-data");
  const siteMode = await getSiteDataMode();

  const newUser = await prisma.user.create({
    data: {
      accountNumber,
      email,
      name,
      passwordHash,
      role,
      // Detected automatically from the signup request's IP — no manual
      // country field on any signup form, for any role (see lib/geo.ts).
      country: signupGeo.country,
      isTestData: siteMode === "test",
      ...(input.role === "READER" ? { readerProfile: { create: {} } } : {}),
      ...(input.role === "AUTHOR"
        ? {
            authorProfile: { create: { primaryGenre: input.genre, penName: input.penName?.trim() || null, referredById, country: signupGeo.country } },
            affiliateProfile: { create: { referralCode: referralCode! } },
          }
        : {}),
    },
  });

  // Fire-and-forget: signup itself must never fail or wait on the
  // verification email actually sending.
  const { sendVerificationEmail } = await import("@/lib/email/verification");
  sendVerificationEmail(newUser.id, input.role === "AUTHOR" ? "AUTHOR" : "ACCOUNT").catch(() => {});

  return { ok: true };
}
