"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";
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
        apiKeys: { ...DEFAULT_SITE_SETTINGS.apiKeys, ...(stored.apiKeys ?? {}) },
        publishingFormatsEnabled: { ...DEFAULT_SITE_SETTINGS.publishingFormatsEnabled, ...(stored.publishingFormatsEnabled ?? {}) },
      };
    }
  } catch {
    // Fall through to defaults if the database is unreachable.
  }
  return DEFAULT_SITE_SETTINGS;
});

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

/**
 * Sends a real, live test email through the exact same sendEmail()
 * path the contact form, order receipts, and everything else use —
 * not a dry-run or a key format check. This is the definitive way to
 * diagnose "the contact form isn't reaching my inbox": whatever this
 * button reports is exactly what's actually happening on a real send,
 * with Resend's real, specific error surfaced directly rather than a
 * generic failure message.
 */
export async function sendTestEmail(toAddress: string): Promise<{ ok: boolean; message: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, message: "Only Admins can do this." };

  const to = toAddress.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, message: "Enter a valid email address to send the test to." };
  }

  const { sendEmail } = await import("@/lib/email");
  const result = await sendEmail(
    to,
    "Test email from The Good Child Bookstore",
    `<div style="font-family: Georgia, serif;"><p>This is a real test send — if you're reading this, delivery is working.</p><p>Sent ${new Date().toISOString()}.</p></div>`
  );

  if (!result.ok) {
    const raw = result.error ?? "Send failed, but no specific error was returned.";
    if (/own email address|testing emails|verify a domain/i.test(raw)) {
      return {
        ok: false,
        message: `Resend blocked this: your account has no verified domain yet, so it only allows sending to the email address you signed up to Resend with — not to ${to}. Verify thegoodchildbookstore.com under Domains in your Resend dashboard to send to any address. (Resend's exact message: "${raw}")`,
      };
    }
    return { ok: false, message: raw };
  }
  return { ok: true, message: `Sent successfully to ${to}. Check that inbox (and its spam folder) for it.` };
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

  const fromEmailInput = settings.apiKeys.fromEmail?.trim();
  if (fromEmailInput) {
    const domain = fromEmailInput.split("@")[1]?.toLowerCase();
    const consumerDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "live.com", "msn.com"];
    if (domain && consumerDomains.includes(domain)) {
      return {
        ok: false,
        error: `"${fromEmailInput}" can't be used as the "From" email — Resend requires a domain you actually own and have verified in your Resend account (Domains tab), and nobody can verify ownership of ${domain}. Use an address on thegoodchildbookstore.com instead, once that domain is verified there.`,
      };
    }
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
