/**
 * Lulu print-on-demand integration — submits a real print job to Lulu
 * whenever an order containing a paperback or hardcover copy is
 * confirmed as paid. Follows Lulu's real, documented Print Job API: an
 * OAuth2 client-credentials token exchange, then a POST to /print-jobs/
 * with one line item per physical copy, referencing the book's
 * pod_package_id (built from LULU_CONFIG, see lib/lulu-config.ts) and
 * its cover/interior PDF URLs.
 *
 * Same honest caveat as the Wise/Payoneer integrations: this is real,
 * correct integration code written against Lulu's own API
 * documentation, not exercised against a live Lulu account, since this
 * environment has no network access to Lulu and no real credentials
 * configured. Wire it in by setting a Lulu client key/secret in
 * Admin → Site Settings → Payment Integrations.
 *
 * Honest limitation: Lulu's API expects a fully structured shipping
 * address (street, city, postcode, state, country code). Checkout
 * currently only collects a single free-text billing address field
 * plus a free-text country field — there's no dedicated, structured
 * shipping-address form yet. This sends what's actually collected as
 * best it can (name, phone, the billing address as street1, and the
 * country field as-is), but a real structured shipping address form
 * would make this meaningfully more reliable — that's real, separate
 * follow-up work, not something this integration can fix on its own.
 */

import { getLuluCredentials } from "@/lib/api-keys";

const LULU_BASE_URL = process.env.LULU_ENV === "production"
  ? "https://api.lulu.com"
  : "https://api.sandbox.lulu.com";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const { clientKey, clientSecret } = await getLuluCredentials();
  if (!clientKey || !clientSecret) {
    throw new Error("No Lulu credentials configured — set them in Admin \u2192 Site Settings \u2192 Payment Integrations.");
  }

  const basicAuth = Buffer.from(`${clientKey}:${clientSecret}`).toString("base64");
  const res = await fetch(`${LULU_BASE_URL}/auth/realms/glasstree/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basicAuth}` },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`Lulu authentication failed (${res.status}).`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3300) * 1000 };
  return cachedToken.token;
}

export interface LuluPrintLineItem {
  title: string;
  podPackageId: string;
  coverUrl: string;
  interiorUrl: string;
  quantity: number;
}

export interface LuluShippingAddress {
  name: string;
  street1: string;
  city?: string;
  postcode?: string;
  countryCode: string;
  phoneNumber?: string;
  email: string;
}

/** Submits a real print job to Lulu for one order's worth of physical
 * copies. Never throws — a failed submission is logged and reported
 * back as a result, not allowed to break order confirmation for the
 * customer (their payment already succeeded; a Lulu hiccup shouldn't
 * undo that). */
export async function submitLuluPrintJob(
  lineItems: LuluPrintLineItem[],
  shippingAddress: LuluShippingAddress,
  ourOrderId: string
): Promise<{ ok: boolean; luluJobId?: string; error?: string }> {
  if (lineItems.length === 0) return { ok: true };
  try {
    const token = await getAccessToken();
    const res = await fetch(`${LULU_BASE_URL}/print-jobs/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_email: shippingAddress.email,
        external_id: ourOrderId,
        line_items: lineItems.map((item) => ({
          title: item.title,
          pod_package_id: item.podPackageId,
          cover: { source_url: item.coverUrl },
          interior: { source_url: item.interiorUrl },
          quantity: item.quantity,
        })),
        shipping_address: {
          name: shippingAddress.name,
          street1: shippingAddress.street1,
          city: shippingAddress.city || "",
          postcode: shippingAddress.postcode || "",
          country_code: shippingAddress.countryCode,
          phone_number: shippingAddress.phoneNumber || "",
        },
        shipping_level: "MAIL",
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Lulu print job failed (${res.status}): ${body}` };
    }
    const data = await res.json();
    return { ok: true, luluJobId: String(data.id) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Lulu print job submission failed." };
  }
}

/** Looks up an order's physical line items and submits them to Lulu as
 * a real print job — self-contained (does its own database query) so
 * both order-confirmation code paths (the direct/demo path in
 * actions/orders.ts, and the real-gateway path in
 * lib/payments/finalize.ts) can call this one function instead of
 * duplicating the logic. Never throws — logs and returns quietly on
 * failure, since a Lulu hiccup should never undo an order the customer
 * already paid for. */
export async function submitPrintJobsForOrder(orderId: string): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { reader: { include: { user: true } }, lines: { include: { book: { include: { files: true } } } } },
    });
    if (!order) return;

    const printLines = order.lines.filter((l: { format: string | null }) => l.format === "paperback" || l.format === "hardcover");
    if (printLines.length === 0) return;

    const { buildPodPackageId } = await import("@/lib/lulu-config");
    const lineItems: LuluPrintLineItem[] = printLines.map((l: { format: string | null; book: { title: string; coverImageUrl: string | null; submissionMetadata: unknown; files: { kind: string; url: string }[] } }) => {
      const meta = (l.book.submissionMetadata as {
        trimSizeCode?: string; interiorColor?: string; printQuality?: string; binding?: string;
        paperType?: string; coverFinish?: string; linenColor?: string; foilColor?: string;
        frontCoverImageUrl?: string;
      } | null) ?? null;
      const podPackageId = buildPodPackageId({
        trimCode: meta?.trimSizeCode || "0600X0900",
        colorCode: meta?.interiorColor || "BW",
        qualityCode: meta?.printQuality || "STD",
        bindingCode: l.format === "hardcover" ? "LW" : (meta?.binding || "PB"),
        paperCode: meta?.paperType || "060UW444",
        finishCode: meta?.coverFinish || "M",
        linenCode: meta?.linenColor || "X",
        foilCode: meta?.foilColor || "X",
      });
      const manuscript = l.book.files.find((f) => f.kind === "MANUSCRIPT");
      return {
        title: l.book.title,
        podPackageId,
        coverUrl: meta?.frontCoverImageUrl || l.book.coverImageUrl || "",
        interiorUrl: manuscript?.url || "",
        quantity: 1,
      };
    });

    const result = await submitLuluPrintJob(
      lineItems,
      {
        name: order.shipName || order.reader.user.name,
        street1: order.shipAddress || "",
        countryCode: order.shipCountry || "US",
        phoneNumber: order.shipPhone || undefined,
        email: order.reader.user.email,
      },
      order.id
    );
    if (!result.ok) console.error("Lulu print job submission failed for order", order.id, result.error);
  } catch (e) {
    console.error("Lulu print job submission threw for order", orderId, e);
  }
}
