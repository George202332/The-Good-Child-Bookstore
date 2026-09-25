"use server";

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
        publishingFormatsEnabled: { ...DEFAULT_SITE_SETTINGS.publishingFormatsEnabled, ...(stored.publishingFormatsEnabled ?? {}) },
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
    payoneerClientId: !!settings.apiKeys.payoneerClientId,
    payoneerClientSecret: !!settings.apiKeys.payoneerClientSecret,
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
        wiseEnabled: settings.apiKeys.wiseEnabled,
        payoneerClientId: "",
        payoneerClientSecret: "",
        payoneerEnabled: settings.apiKeys.payoneerEnabled,
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
    const newWiseToken = settings.apiKeys.wiseApiToken?.trim();
    let wiseProfileId = existing.apiKeys.wiseProfileId;
    let wiseTokenError: string | undefined;
    if (newWiseToken && newWiseToken !== existing.apiKeys.wiseApiToken) {
      // A genuinely new token was entered — look up its real profile id
      // from Wise directly, rather than asking the admin to find and
      // enter it manually.
      const { discoverWiseProfileId } = await import("@/lib/payments/wise");
      const discovery = await discoverWiseProfileId(newWiseToken);
      if (discovery.profileId) wiseProfileId = discovery.profileId;
      else wiseTokenError = discovery.error;
    }

    const apiKeys: ApiKeys = {
      paymentMode: settings.apiKeys.paymentMode,
      luluClientKey: settings.apiKeys.luluClientKey?.trim() || existing.apiKeys.luluClientKey,
      luluClientSecret: settings.apiKeys.luluClientSecret?.trim() || existing.apiKeys.luluClientSecret,
      resendApiKey: settings.apiKeys.resendApiKey?.trim() || existing.apiKeys.resendApiKey,
      fromEmail: settings.apiKeys.fromEmail?.trim() || existing.apiKeys.fromEmail,
      paystackSecretKey: settings.apiKeys.paystackSecretKey?.trim() || existing.apiKeys.paystackSecretKey,
      paystackPublicKey: settings.apiKeys.paystackPublicKey?.trim() || existing.apiKeys.paystackPublicKey,
      wiseApiToken: newWiseToken || existing.apiKeys.wiseApiToken,
      wiseProfileId,
      // Only one payout provider is ever active at once — enforced here
      // too, not just in the form, so a stale client or a direct action
      // call can't leave both switched on. Wise wins if both were
      // somehow sent true.
      wiseEnabled: settings.apiKeys.wiseEnabled,
      payoneerClientId: settings.apiKeys.payoneerClientId?.trim() || existing.apiKeys.payoneerClientId,
      payoneerClientSecret: settings.apiKeys.payoneerClientSecret?.trim() || existing.apiKeys.payoneerClientSecret,
      payoneerEnabled: settings.apiKeys.wiseEnabled ? false : settings.apiKeys.payoneerEnabled,
    };

    const value = JSON.parse(JSON.stringify({ ...settings, apiKeys }));
    await prisma.setting.upsert({
      where: { key: SITE_SETTINGS_KEY },
      update: { value },
      create: { key: SITE_SETTINGS_KEY, value },
    });
    revalidatePath("/");
    revalidatePath("/admin/site-settings");
    if (wiseTokenError) {
      return { ok: true, error: `Saved, but couldn't verify the new Wise token: ${wiseTokenError}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `Couldn't save: ${e.message}` : "Couldn't save settings — please try again." };
  }
}
