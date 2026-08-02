"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { DEFAULT_SITE_SETTINGS, type SiteSettings, type ApiKeys } from "@/lib/site-settings";

/**
 * Site-wide branding/footer/API-credentials control. Built on the same
 * generic Setting key-value table as the page-content CMS
 * (actions/page-content.ts). Logo/favicon/badge images are either a real
 * upload (converted to WebP, see actions/images.ts) or a pasted URL.
 *
 * Payment Integrations rebuilt per explicit instruction: PayPal removed
 * entirely; Paystack collapsed to one secret/public pair (paymentMode is
 * now just a label, not a switch between two stored sets); Wise and
 * Lulu both get the same backend-manageable secret/public (or
 * client key/secret) pair treatment.
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
export async function getSiteSettingsForEditing(): Promise<{ settings: SiteSettings; apiKeysSet: Record<string, boolean> }> {
  const settings = await getSiteSettings();
  const apiKeysSet: Record<string, boolean> = {
    luluClientKey: !!settings.apiKeys.luluClientKey,
    luluClientSecret: !!settings.apiKeys.luluClientSecret,
    resendApiKey: !!settings.apiKeys.resendApiKey,
    paystackSecretKey: !!settings.apiKeys.paystackSecretKey,
    paystackPublicKey: !!settings.apiKeys.paystackPublicKey,
    wiseApiToken: !!settings.apiKeys.wiseApiToken,
    wiseProfileId: !!settings.apiKeys.wiseProfileId,
  };
  return {
    settings: {
      ...settings,
      apiKeys: {
        paymentMode: settings.apiKeys.paymentMode,
        luluClientKey: "",
        luluClientSecret: "",
        resendApiKey: "",
        fromEmail: settings.apiKeys.fromEmail ?? "",
        paystackSecretKey: "",
        paystackPublicKey: "",
        wiseApiToken: "",
        wiseProfileId: "",
      },
    },
    apiKeysSet,
  };
}

export async function testPaystackConnection(): Promise<{ ok: boolean; message: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, message: "Only Admins can do this." };

  const settings = await getSiteSettings();
  const secretKey = settings.apiKeys.paystackSecretKey?.trim() || process.env.PAYSTACK_SECRET_KEY;
  const mode = settings.apiKeys.paymentMode;

  if (!secretKey) {
    return {
      ok: false,
      message: "No Paystack secret key found — not in Site Settings, and not in the PAYSTACK_SECRET_KEY environment variable either. Enter one above and save first.",
    };
  }

  try {
    const res = await fetch("https://api.paystack.co/transaction?perPage=1", {
      headers: { Authorization: `Bearer ${secretKey}` },
      cache: "no-store",
    });
    if (res.ok) {
      const source = settings.apiKeys.paystackSecretKey?.trim() ? "Site Settings" : "the PAYSTACK_SECRET_KEY environment variable";
      return { ok: true, message: `Connected successfully using the key from ${source} (labeled as ${mode} mode). Paystack accepted it.` };
    }
    if (res.status === 401) {
      return { ok: false, message: "Paystack rejected this key as invalid (401 Unauthorized). Double-check it was copied correctly." };
    }
    return { ok: false, message: `Paystack responded with an unexpected status (${res.status}). The key format may be valid, but something else is wrong — check Paystack's own dashboard for account issues.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? `Could not reach Paystack: ${e.message}` : "Could not reach Paystack." };
  }
}

export async function updateSiteSettings(settings: SiteSettings): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Only Admins can edit site settings." };
  }

  try {
    // Any API key field left blank keeps whatever's already saved, rather
    // than erasing a working credential just because the admin didn't
    // retype it (the form never shows the real value back, on purpose).
    const existing = await getSiteSettings();
    const apiKeys: ApiKeys = {
      paymentMode: settings.apiKeys.paymentMode,
      luluClientKey: settings.apiKeys.luluClientKey?.trim() || existing.apiKeys.luluClientKey,
      luluClientSecret: settings.apiKeys.luluClientSecret?.trim() || existing.apiKeys.luluClientSecret,
      resendApiKey: settings.apiKeys.resendApiKey?.trim() || existing.apiKeys.resendApiKey,
      fromEmail: settings.apiKeys.fromEmail?.trim() || existing.apiKeys.fromEmail,
      paystackSecretKey: settings.apiKeys.paystackSecretKey?.trim() || existing.apiKeys.paystackSecretKey,
      paystackPublicKey: settings.apiKeys.paystackPublicKey?.trim() || existing.apiKeys.paystackPublicKey,
      wiseApiToken: settings.apiKeys.wiseApiToken?.trim() || existing.apiKeys.wiseApiToken,
      wiseProfileId: settings.apiKeys.wiseProfileId?.trim() || existing.apiKeys.wiseProfileId,
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
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `Couldn't save: ${e.message}` : "Couldn't save settings — please try again." };
  }
}
