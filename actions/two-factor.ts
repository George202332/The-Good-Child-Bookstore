"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  getTwoFactorStatus,
  startTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
  sendLoginChallenge,
  verifyLoginChallenge,
  type TwoFactorMethod,
  type TwoFactorStatus,
} from "@/lib/two-factor";

/**
 * Server actions for two-factor authentication — the boundary that
 * checks "who is asking" before handing off to lib/two-factor.ts's
 * actual logic. Used by both the Settings page (setup/disable) and
 * the post-login challenge screen (request/verify).
 */

export async function getMyTwoFactorStatus(): Promise<TwoFactorStatus> {
  const session = await auth();
  if (!session?.user) return { enabled: false, method: null, maskedDestination: null, pendingMethod: null, pendingMaskedDestination: null };
  return getTwoFactorStatus(session.user.id);
}

export async function startMyTwoFactorSetup(method: TwoFactorMethod, phoneNumber: string | null): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };
  return startTwoFactorSetup(session.user.id, method, phoneNumber);
}

export async function confirmMyTwoFactorSetup(code: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };
  if (!code.trim()) return { ok: false, error: "Enter the code from your email or phone." };
  return confirmTwoFactorSetup(session.user.id, code);
}

/** Requires the current password, exactly like changing a password —
 * disabling 2FA is a meaningful security downgrade, so it gets the
 * same confirmation step rather than a single unguarded toggle. */
export async function disableMyTwoFactor(currentPassword: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { ok: false, error: "Account not found." };

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "Current password is incorrect." };

  await disableTwoFactor(session.user.id);
  return { ok: true };
}

/** Called from the post-login challenge screen — the session already
 * exists (password was correct) but is pending the second factor. */
export async function requestMyLoginChallenge(): Promise<{ ok: boolean; error?: string; method?: TwoFactorMethod; maskedDestination?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };
  return sendLoginChallenge(session.user.id);
}

export async function verifyMyLoginChallenge(code: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };
  if (!code.trim()) return { ok: false, error: "Enter the code you received." };
  return verifyLoginChallenge(session.user.id, code);
}
