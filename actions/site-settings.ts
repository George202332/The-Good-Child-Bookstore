"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";
import { resolvePayoutMethodToggles, type PayoutMethodToggles } from "@/lib/payout-method-availability";
import { normaliseEnabledLevels } from "@/lib/lulu-order";
import { DEFAULT_SITE_SETTINGS, type SiteSettings, type ApiKeys, type PublishingFormatsEnabled } from "@/lib/site-settings";

/**
 * Site-wide branding/footer/API-credentials control. Built on the same
 * generic Setting key-value table as the page-content CMS
 * (actions/page-content.ts). Logo/favicon/badge images are either a real
 * upload (converted to WebP, see actions/images.ts) or a pasted URL.
 *
 * Payment Integrations rebuilt per explicit instruction: PayPal removed
 * entirely; Paystack collapsed to one secret/public pair (paymentMode is
 * now just a label, not a switch between two stored sets); Lulu gets the
 * same backend-manageable client key/secret pair treatment.
 */

const SITE_SETTINGS_KEY = "site_settings";

// React's per-request cache — RootLayout and generateMetadata() (see
// app/layout.tsx) both need these settings on every single request,
// and without this they were each running their own separate database
// round trip for the exact same row on every page view. cache() here
// dedupes those into one fetch per request, which every route shares,
// no actual data ever goes stale any later than it already did.
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: SITE_SETTINGS_KEY } });
    if (setting?.value && typeof setting.value === "object") {
      const stored = setting.value as Partial<SiteSettings>;
      return {
        ...DEFAULT_SITE_SETTINGS,
        ...stored,
        paymentBadges: { ...DEFAULT_SITE_SETTINGS.paymentBadges, ...(stored.paymentBadges ?? {}) },
        // Merged per-slot (not a flat spread) so an older saved settings
        // row — from before this round, with no socialLinks at all, or a
        // partial one missing a slot — still comes back with all 6 keys
        // present and each slot's own defaults intact.
        socialLinks: {
          facebook: { ...DEFAULT_SITE_SETTINGS.socialLinks.facebook, ...(stored.socialLinks?.facebook ?? {}) },
          instagram: { ...DEFAULT_SITE_SETTINGS.socialLinks.instagram, ...(stored.socialLinks?.instagram ?? {}) },
          pinterest: { ...DEFAULT_SITE_SETTINGS.socialLinks.pinterest, ...(stored.socialLinks?.pinterest ?? {}) },
          youtube: { ...DEFAULT_SITE_SETTINGS.socialLinks.youtube, ...(stored.socialLinks?.youtube ?? {}) },
          twitter: { ...DEFAULT_SITE_SETTINGS.socialLinks.twitter, ...(stored.socialLinks?.twitter ?? {}) },
          tiktok: { ...DEFAULT_SITE_SETTINGS.socialLinks.tiktok, ...(stored.socialLinks?.tiktok ?? {}) },
        },
        // Only the plain shipping choice is read. Any old stored key fields are ignored (and removed by the cleanup migration).
        apiKeys: { ...(stored.apiKeys?.luluShippingLevels ? { luluShippingLevels: stored.apiKeys.luluShippingLevels } : {}) },
        publishingFormatsEnabled: { ...DEFAULT_SITE_SETTINGS.publishingFormatsEnabled, ...(stored.publishingFormatsEnabled ?? {}) },
        // Payout-method toggles: only a literal true counts as ON.
        ...resolvePayoutMethodToggles(stored),
      };
    }
  } catch {
    // Fall through to defaults if the database is unreachable.
  }
  return DEFAULT_SITE_SETTINGS;
});

/**
 * The settings for the Site Management form. Keys are no longer stored in the database (they live only in Vercel), so
 * nothing secret can ever be in here; only the plain shipping-method choice remains under apiKeys.
 */
export async function getSiteSettingsForEditing(): Promise<{ settings: SiteSettings; apiKeysSet: Record<string, boolean> }> {
  const settings = await getSiteSettings();
  return {
    settings: { ...settings, apiKeys: { luluShippingLevels: normaliseEnabledLevels(settings.apiKeys.luluShippingLevels) } },
    apiKeysSet: {},
  };
}

/** Admin-only: which shipping methods customers may choose for printed copies (not a secret). */
export async function saveShippingLevels(levels: string[]): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can change this." };
  try {
    const existing = await getSiteSettings();
    const value = JSON.parse(JSON.stringify({ ...existing, apiKeys: { luluShippingLevels: normaliseEnabledLevels(levels) } }));
    await prisma.setting.upsert({ where: { key: SITE_SETTINGS_KEY }, update: { value }, create: { key: SITE_SETTINGS_KEY, value } });
    revalidatePath("/admin/site-settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `Couldn't save: ${e.message}` : "Couldn't save - please try again." };
  }
}

export async function updatePublishingFormats(formats: PublishingFormatsEnabled): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Only Admins can control which formats are open for submission." };
  }
  try {
    const existing = await getSiteSettings();
    const value = JSON.parse(JSON.stringify({ ...existing, publishingFormatsEnabled: formats }));
    await prisma.setting.upsert({
      where: { key: SITE_SETTINGS_KEY },
      update: { value },
      create: { key: SITE_SETTINGS_KEY, value },
    });
    revalidatePath("/admin/books");
    revalidatePath("/account/books/new");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `Couldn't save: ${e.message}` : "Couldn't save — please try again." };
  }
}

export async function updateSiteSettings(settings: SiteSettings): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Only Admins can edit site settings." };
  }

  try {
    // Keys are not stored here any more. Always keep the saved shipping-method choice (it has its own action) and
    // never write any key field, even if an old copy of this form sends one.
    const existing = await getSiteSettings();
    const apiKeys: ApiKeys = { luluShippingLevels: existing.apiKeys.luluShippingLevels };

    // The payout-method toggles have their own action
    // (updatePayoutMethodToggles). Always keep the saved values here so a
    // stale copy of this form (or the API Management form) can't undo them.
    const value = JSON.parse(
      JSON.stringify({
        ...settings,
        apiKeys,
        paypalPayoutsEnabled: existing.paypalPayoutsEnabled,
        mpesaPayoutsEnabled: existing.mpesaPayoutsEnabled,
      })
    );
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

/**
 * Admin-only: switch PayPal / M-Pesa on or off as selectable PAYOUT
 * methods (separate from the checkout payment settings). Saved in the
 * same Setting JSON row as the rest of the site settings; no schema change.
 */
export async function updatePayoutMethodToggles(toggles: PayoutMethodToggles): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Only Admins can change payout method availability." };
  }
  try {
    const existing = await getSiteSettings();
    const value = JSON.parse(
      JSON.stringify({
        ...existing,
        paypalPayoutsEnabled: toggles.paypalPayoutsEnabled === true,
        mpesaPayoutsEnabled: toggles.mpesaPayoutsEnabled === true,
      })
    );
    await prisma.setting.upsert({
      where: { key: SITE_SETTINGS_KEY },
      update: { value },
      create: { key: SITE_SETTINGS_KEY, value },
    });
    revalidatePath("/admin/site-settings");
    revalidatePath("/account/profile");
    revalidatePath("/account/payout-settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `Couldn't save: ${e.message}` : "Couldn't save — please try again." };
  }
}
