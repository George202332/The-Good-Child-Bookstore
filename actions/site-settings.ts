"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/site-settings";

/**
 * Site-wide branding/footer control — "control all the website front...
 * logo... change texts... including the footer... upload the images of
 * PayPal, Mastercard, Visa, American Express, and Verve cards" from the
 * explicit request. Built on the same generic Setting key-value table as
 * the homepage hero CMS (actions/cms.ts). Image fields are URLs, same
 * scope limitation as the book cover/submission flow — real file upload
 * needs storage (S3/Cloudinary) wired in, which isn't set up yet.
 */

const SITE_SETTINGS_KEY = "site_settings";

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: SITE_SETTINGS_KEY } });
    if (setting?.value && typeof setting.value === "object") {
      const stored = setting.value as Partial<SiteSettings>;
      return {
        ...DEFAULT_SITE_SETTINGS,
        ...stored,
        paymentBadges: { ...DEFAULT_SITE_SETTINGS.paymentBadges, ...(stored.paymentBadges ?? {}) },
      };
    }
  } catch {
    // Fall through to defaults if the database is unreachable.
  }
  return DEFAULT_SITE_SETTINGS;
}

export async function updateSiteSettings(settings: SiteSettings): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Only Admins can edit site settings." };
  }

  const value = JSON.parse(JSON.stringify(settings));
  await prisma.setting.upsert({
    where: { key: SITE_SETTINGS_KEY },
    update: { value },
    create: { key: SITE_SETTINGS_KEY, value },
  });
  revalidatePath("/");
  revalidatePath("/admin/site-settings");
  return { ok: true };
}
