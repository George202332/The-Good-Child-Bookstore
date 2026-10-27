"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { authAdmin } from "@/lib/auth-admin";
import { prisma } from "@/lib/prisma";
import { DEFAULT_APPEARANCE, normalizeAppearance, type AccountAppearance } from "@/lib/account-fonts";

/**
 * Per-user font + size for the account area. Stored on the user's Settings
 * row (fontFamily / fontSize), so it follows the account to any device and
 * survives logout and cleared caches.
 */

/** Never throws: if the columns don't exist yet (before `prisma db push`) or the
 * database hiccups, the account area simply keeps its normal look. */
export async function getAppearanceForUser(userId: string): Promise<AccountAppearance> {
  try {
    const row = await prisma.settings.findUnique({ where: { userId }, select: { fontFamily: true, fontSize: true } });
    return normalizeAppearance(row);
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** `area` says which login the Settings screen belongs to: the public-account
 * session (readers/authors) or the separate staff session (backend). */
export async function saveMyAppearance(
  area: "account" | "admin",
  input: AccountAppearance,
): Promise<{ ok: boolean; error?: string }> {
  const session = area === "admin" ? await authAdmin() : await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };
  const clean = normalizeAppearance(input);
  try {
    await prisma.settings.upsert({
      where: { userId: session.user.id },
      update: clean,
      create: { userId: session.user.id, ...clean },
    });
  } catch {
    return { ok: false, error: "Could not save right now. Please try again." };
  }
  revalidatePath(area === "admin" ? "/admin/settings" : "/account/settings");
  return { ok: true };
}
