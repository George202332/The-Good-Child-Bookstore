"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logSelfServiceEvent } from "@/lib/audit-log";

/** Real password change — Security page, all roles. */
export async function changeMyPassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };
  if (newPassword.length < 6) return { ok: false, error: "New password must be at least 6 characters." };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { ok: false, error: "Account not found." };

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "Current password is incorrect." };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash, mustChangePassword: false, guestSetupPending: false } });
  // Event only — never any password value or hash.
  await logSelfServiceEvent(session.user.id, "PASSWORD_CHANGED", { summary: "Changed account password" });
  return { ok: true };
}

/**
 * First password for an account a guest checkout created. The person arrived with
 * a one-time sign-in link, so there is no "current password" to ask for; this is
 * allowed ONLY for an account still flagged guestSetupPending, and only for the
 * signed-in account itself. Everyone else changes their password with the action
 * above, which needs the current one.
 */
export async function setInitialPassword(newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };
  if (newPassword.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const res = await prisma.user.updateMany({
    where: { id: session.user.id, guestSetupPending: true },
    data: { passwordHash, mustChangePassword: false, guestSetupPending: false },
  });
  if (res.count === 0) return { ok: false, error: "Your password is already set. Use Security settings to change it." };
  await logSelfServiceEvent(session.user.id, "PASSWORD_CHANGED", { summary: "Set first account password" });
  return { ok: true };
}
