"use server";

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Real password reset, for every account type including backend roles
 * (Admin/Editor/Accountant) — it's just email-based identity, nothing
 * role-specific. A one-time token, expiring in 1 hour, emailed via the
 * same Resend integration used for order receipts.
 */

export async function requestPasswordReset(email: string): Promise<{ ok: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    // Always return ok, whether or not the email matches an account —
    // this is deliberate: confirming which emails do/don't have an
    // account here would let anyone probe your user list.
    if (!user) return { ok: true };

    const token = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    const resetUrl = `${getSiteUrl()}/reset-password?token=${token}`;
    await sendEmail(
      user.email,
      "Reset your password",
      `<div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>Someone requested a password reset for this account. If that was you, click below — this link expires in 1 hour.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#FF8C6B;color:#000;text-decoration:none;border-radius:8px;font-weight:bold;">Reset password</a></p>
        <p style="color:#888; font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
      </div>`
    );

    return { ok: true };
  } catch {
    return { ok: true };
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  if (newPassword.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  try {
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!resetToken) return { ok: false, error: "That reset link isn't valid." };
    if (resetToken.usedAt) return { ok: false, error: "That reset link has already been used." };
    if (resetToken.expiresAt < new Date()) return { ok: false, error: "That reset link has expired — request a new one." };

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    ]);

    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
