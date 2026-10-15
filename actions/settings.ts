"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** Real account settings — the Settings model existed in the schema
 * (notification toggles) but had no UI. */

export interface MySettings {
  notifyPayouts: boolean;
  notifyReviews: boolean;
  notifyBlogComments: boolean;
}

const DEFAULT_SETTINGS: MySettings = { notifyPayouts: true, notifyReviews: true, notifyBlogComments: true };

// Dark mode was removed from every account. Anyone who had switched it on
// still has this cookie (and the root layout's script reads it), so saving
// settings clears it and the site returns to the normal light theme.
const DARK_MODE_COOKIE = "gcb-dark-mode";

export async function getMySettings(): Promise<MySettings> {
  const session = await auth();
  if (!session?.user) return DEFAULT_SETTINGS;
  const settings = await prisma.settings.findUnique({ where: { userId: session.user.id } });
  if (!settings) return DEFAULT_SETTINGS;
  return {
    notifyPayouts: settings.notifyPayouts,
    notifyReviews: settings.notifyReviews,
    notifyBlogComments: settings.notifyBlogComments,
  };
}

export async function updateMySettings(input: MySettings): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };

  await prisma.settings.upsert({
    where: { userId: session.user.id },
    update: input,
    create: { userId: session.user.id, ...input },
  });

  try {
    const cookieStore = await cookies();
    cookieStore.delete(DARK_MODE_COOKIE);
  } catch {
    // Non-critical.
  }

  revalidatePath("/account/settings");
  return { ok: true };
}

/** Marketing opt-in — deliberately its own action, not folded into
 * MySettings above, since it lives on User.marketingOptIn directly
 * (checked by lib/email/marketing.ts's send list) rather than the
 * per-user Settings table. Defaults to false; only the reader's own
 * explicit toggle here, or clicking unsubscribe, ever changes it. */
export async function getMarketingOptIn(): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { marketingOptIn: true } });
  return user?.marketingOptIn ?? false;
}

export async function setMarketingOptIn(optIn: boolean): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };
  await prisma.user.update({ where: { id: session.user.id }, data: { marketingOptIn: optIn } });
  revalidatePath("/account/settings");
  return { ok: true };
}
