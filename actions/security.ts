"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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
  await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash } });
  return { ok: true };
}
