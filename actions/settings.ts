"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** Real account settings — the Settings model existed in the schema
 * (dark mode, reduce motion, notification toggles) but had no UI. */

export interface MySettings {
  darkMode: boolean;
  reduceMotion: boolean;
  notifyPayouts: boolean;
  notifyReviews: boolean;
  notifyBlogComments: boolean;
}

const DEFAULT_SETTINGS: MySettings = { darkMode: false, reduceMotion: false, notifyPayouts: true, notifyReviews: true, notifyBlogComments: true };

export async function getMySettings(): Promise<MySettings> {
  const session = await auth();
  if (!session?.user) return DEFAULT_SETTINGS;
  const settings = await prisma.settings.findUnique({ where: { userId: session.user.id } });
  return settings ?? DEFAULT_SETTINGS;
}

export async function updateMySettings(input: MySettings): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };

  await prisma.settings.upsert({
    where: { userId: session.user.id },
    update: input,
    create: { userId: session.user.id, ...input },
  });
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
