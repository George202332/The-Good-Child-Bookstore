"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { DEFAULT_SITE_SETTINGS, type SiteSettings, type ApiKeys } from "@/lib/site-settings";

/**
 * Site-wide branding/footer/API-credentials control — "control all the
 * website front... logo... texts... including the footer... upload the
 * images of PayPal, M-Pesa, Mastercard, Visa, American Express, and
 * Verve cards... a section for APIs where I will be inserting the APIs
 * for Lulu, PayPal, Paystack" from the explicit request. Built on the
 * same generic Setting key-value table as the page-content CMS
 * (actions/page-content.ts). Logo/favicon/badge images are either a real
 * upload (converted to WebP, see actions/images.ts) or a pasted URL.
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
        apiKeys: { ...DEFAULT_SITE_SETTINGS.apiKeys, ...(stored.apiKeys ?? {}) },
      };
    }
  } catch {
    // Fall through to defaults if the database is unreachable.
  }
  return DEFAULT_SITE_SETTINGS;
}

/**
 * The version of settings safe to send to the admin's browser: identical
 * to getSiteSettings() except every API key value is stripped to an
 * empty string (only whether one is set is exposed, as a boolean) — the
 * actual secret is never sent to the client once saved. Only used for
 * populating the Site Settings form; getSiteSettings() (with real values)
 * is what the payment services actually call.
 */
export async function getSiteSettingsForEditing(): Promise<{ settings: SiteSettings; apiKeysSet: Record<keyof ApiKeys, boolean> }> {
  const settings = await getSiteSettings();
  const apiKeysSet: Record<keyof ApiKeys, boolean> = {
    luluApiKey: !!settings.apiKeys.luluApiKey,
    paypalClientId: !!settings.apiKeys.paypalClientId,
    paypalClientSecret: !!settings.apiKeys.paypalClientSecret,
    paystackSecretKey: !!settings.apiKeys.paystackSecretKey,
  };
  return {
    settings: { ...settings, apiKeys: { luluApiKey: "", paypalClientId: "", paypalClientSecret: "", paystackSecretKey: "" } },
    apiKeysSet,
  };
}

export async function updateSiteSettings(settings: SiteSettings): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Only Admins can edit site settings." };
  }

  // Any API key field left blank keeps whatever's already saved, rather
  // than erasing a working credential just because the admin didn't
  // retype it (the form never shows the real value back, on purpose).
  const existing = await getSiteSettings();
  const apiKeys: ApiKeys = {
    luluApiKey: settings.apiKeys.luluApiKey?.trim() || existing.apiKeys.luluApiKey,
    paypalClientId: settings.apiKeys.paypalClientId?.trim() || existing.apiKeys.paypalClientId,
    paypalClientSecret: settings.apiKeys.paypalClientSecret?.trim() || existing.apiKeys.paypalClientSecret,
    paystackSecretKey: settings.apiKeys.paystackSecretKey?.trim() || existing.apiKeys.paystackSecretKey,
  };

  const value = JSON.parse(JSON.stringify({ ...settings, apiKeys }));
  await prisma.setting.upsert({
    where: { key: SITE_SETTINGS_KEY },
    update: { value },
    create: { key: SITE_SETTINGS_KEY, value },
  });
  revalidatePath("/");
  revalidatePath("/admin/site-settings");
  return { ok: true };
}
