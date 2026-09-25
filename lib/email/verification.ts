import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getPublicSiteUrl as getSiteUrl } from "@/lib/seo/site-url";

/**
 * Centralized email verification — covers both general account
 * verification (any Reader/Author, confirming they own the email they
 * signed up with) and author identity verification specifically
 * (purpose: "AUTHOR"), which is what a published book's "Verified
 * Author" status can be based on. Same token mechanism, same 24-hour
 * expiry, same one-time-use guarantee as password reset tokens — the
 * only difference is which link and copy the email uses.
 */
export async function sendVerificationEmail(userId: string, purpose: "ACCOUNT" | "AUTHOR" = "ACCOUNT"): Promise<{ ok: boolean; error?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "Account not found." };

  const token = randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: { userId, token, purpose, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });

  const verifyUrl = `${getSiteUrl()}/verify-email?token=${token}`;
  const isAuthor = purpose === "AUTHOR";

  return sendEmail(
    user.email,
    isAuthor ? "Verify your author identity" : "Verify your email address",
    `<div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto;">
      <h2>${isAuthor ? "Confirm you're the author" : "Confirm your email"}</h2>
      <p>Hi ${user.name},</p>
      <p>${isAuthor
        ? "Please confirm this is really you, so your books can carry a verified-author status."
        : "Please confirm this email address to finish setting up your account."}</p>
      <p><a href="${verifyUrl}" style="background: #C4645A; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">Verify now</a></p>
      <p style="color: #888; font-size: 12px;">This link expires in 24 hours. If you didn't request this, you can safely ignore this email.</p>
    </div>`
  );
}

/** Confirms a verification token and marks the account (or, for
 * author-purpose tokens, the author identity) as verified. One-time
 * use — a second attempt with the same token is rejected. */
export async function confirmEmailVerification(token: string): Promise<{ ok: boolean; error?: string; purpose?: string }> {
  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record) return { ok: false, error: "This verification link is invalid." };
  if (record.usedAt) return { ok: false, error: "This verification link has already been used." };
  if (record.expiresAt < new Date()) return { ok: false, error: "This verification link has expired — request a new one." };

  await prisma.$transaction([
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);

  return { ok: true, purpose: record.purpose };
}
