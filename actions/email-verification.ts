"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email/verification";

/**
 * Resend-my-verification-email — used by the "verify your account"
 * blocking screen (components/EmailVerificationRequired.tsx). Reuses
 * the exact same sendVerificationEmail() the signup flow already
 * calls, over the existing Resend integration — no second email
 * system. Rate-limited so a signed-in-but-unverified user (or a
 * script) can't hammer the resend button.
 */

const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_RESENDS_PER_HOUR = 5;

export async function resendMyVerificationEmail(): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { ok: false, error: "Account not found." };
  if (user.emailVerifiedAt) return { ok: true }; // already verified — nothing to resend

  const recent = await prisma.emailVerificationToken.findMany({
    where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    take: MAX_RESENDS_PER_HOUR,
  });
  if (recent.length > 0 && Date.now() - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "Please wait a moment before requesting another verification email." };
  }
  if (recent.length >= MAX_RESENDS_PER_HOUR) {
    return { ok: false, error: "Too many verification emails requested recently — please try again in an hour." };
  }

  const result = await sendVerificationEmail(user.id, user.role === "AUTHOR" ? "AUTHOR" : "ACCOUNT");
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Could not send the verification email." };
}
