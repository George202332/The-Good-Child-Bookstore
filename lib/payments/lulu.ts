/**
 * Lulu print-on-demand integration — submits a real print job to Lulu
 * whenever an order containing a paperback or hardcover copy is
 * confirmed as paid. Follows Lulu's documented Print Job API: an
 * OAuth2 client-credentials token exchange, then a POST to /print-jobs/
 * with one line item per book, referencing the book's pod_package_id
 * (built from LULU_CONFIG, see lib/lulu-config.ts) and its cover/interior
 * file URLs. The pure rules (package code format, address checks, request
 * body) live in lib/lulu-order.ts so they can be tested without a network.
 *
 * What makes a print order reach Lulu (and what used to stop it):
 *  - Right Lulu system: orders go to Production or Sandbox according to the
 *    setting in Admin → API Management (see lib/api-keys.ts
 *    getLuluEnvironment). They used to go to the Sandbox whenever the
 *    LULU_ENV variable was not set, where they never appear in the real
 *    Lulu account.
 *  - Valid request: the package code is sent without dots (max 27
 *    characters), file URLs are absolute, quantities match what was bought
 *    and the shipping address is complete (city, postal code, state, ISO
 *    country code). Any of those wrong used to make Lulu reject the job.
 *  - Never silent: a job that cannot be sent is marked FAILED with the
 *    reason, support is emailed and it is logged on the Site Health page,
 *    and an admin can resend it from Admin → Transactions.
 *  - Never twice: a job is claimed before it is sent, so the payment
 *    webhook and the return page cannot both submit the same order.
 *
 * Still a limitation: Lulu prints from a print-ready cover PDF at an exact
 * size (front + spine + back). This site stores the front cover image and
 * the interior file; it does not generate a cover wrap PDF. The job is
 * created in Lulu (so it appears there), but Lulu may flag the cover file.
 */

import { getLuluCredentials, getLuluEnvironment } from "@/lib/api-keys";
import {
  absoluteFileUrl,
  buildLuluAddress,
  buildLuluPrintJobBody,
  lineProblems,
  luluBaseUrl,
  shippingProblems,
  toLuluPodPackageId,
  type LuluAddress,
  type LuluJobLine,
} from "@/lib/lulu-order";

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(baseUrl: string): Promise<string> {
  const { clientKey, clientSecret } = await getLuluCredentials();
  if (!clientKey || !clientSecret) {
    throw new Error("No Lulu credentials configured — set them in Admin → API Management → Print-on-Demand (Lulu).");
  }
  const cacheKey = `${baseUrl}|${clientKey}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const basicAuth = Buffer.from(`${clientKey}:${clientSecret}`).toString("base64");
  const res = await fetch(`${baseUrl}/auth/realms/glasstree/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basicAuth}` },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!res.ok) {
    throw new Error(
      `Lulu authentication failed (${res.status}) against ${baseUrl}. Check that the Client Key/Secret match this Lulu system — Sandbox and Production use different keys.`
    );
  }
  const data = await res.json();
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + ((data.expires_in ?? 3300) - 60) * 1000 });
  return data.access_token as string;
}

export type LuluPrintLineItem = LuluJobLine;

/** Submits a real print job to Lulu for one order's worth of physical
 * copies. Never throws — a failed submission is reported back as a
 * result, not allowed to break order confirmation for the customer
 * (their payment already succeeded; a Lulu hiccup shouldn't undo that). */
export async function submitLuluPrintJob(
  lines: LuluJobLine[],
  address: LuluAddress,
  ourOrderId: string,
  contactEmail: string
): Promise<{ ok: boolean; luluJobId?: string; error?: string }> {
  if (lines.length === 0) return { ok: true };
  try {
    const baseUrl = luluBaseUrl(await getLuluEnvironment());
    const token = await getAccessToken(baseUrl);
    const res = await fetch(`${baseUrl}/print-jobs/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildLuluPrintJobBody({ externalId: ourOrderId, contactEmail, address, lines })),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Lulu print job failed (${res.status}) at ${baseUrl}: ${body}`.slice(0, 1500) };
    }
    const data = await res.json();
    return { ok: true, luluJobId: String(data.id) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Lulu print job submission failed." };
  }
}

export interface PrintJobOutcome {
  ok: boolean;
  /** "none" = the order has no print copies; "already" = it was already sent. */
  state: "submitted" | "failed" | "none" | "already" | "missing" | "not-paid";
  error?: string;
}

async function markFailed(orderId: string, message: string): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  await prisma.order.update({
    where: { id: orderId },
    data: { printJobStatus: "FAILED", printJobId: null, printJobError: message.slice(0, 1900) },
  });
  console.error("Lulu print job not sent for order", orderId, message);
  const { reportSystemError } = await import("@/lib/site-health/alert");
  await reportSystemError("CHECKOUT", new Error(`Print order ${orderId.slice(0, 8).toUpperCase()} was not sent to Lulu: ${message}`), { orderId });
}

/** Looks up a paid order's physical line items and submits them to Lulu as
 * one print job. Self-contained (does its own database work) so both
 * order-confirmation paths (the direct/demo path in actions/orders.ts and
 * the real-gateway path in lib/payments/finalize.ts) call this one
 * function. Safe to call more than once for the same order: a job that is
 * already sent (or being sent) is never submitted again, unless an admin
 * explicitly resends a failed one (`resend: true`). Never throws. */
export async function submitPrintJobsForOrder(orderId: string, opts: { resend?: boolean } = {}): Promise<PrintJobOutcome> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { reader: { include: { user: true } }, lines: { include: { book: { include: { files: true } } } } },
    });
    if (!order) return { ok: false, state: "missing", error: "Order not found." };
    if (order.status !== "PAID") return { ok: false, state: "not-paid", error: "This order has not been paid yet." };

    const printLines = order.lines.filter((l: { format: string | null }) => l.format === "paperback" || l.format === "hardcover");
    if (printLines.length === 0) return { ok: true, state: "none" };

    // Claim the order so only one caller submits it. A normal call only
    // claims an order that was never sent or previously failed; an admin
    // resend may also take over one stuck mid-submission.
    const claimable = opts.resend
      ? [{ printJobStatus: null }, { printJobStatus: "FAILED" }, { printJobStatus: "SUBMITTING" }]
      : [{ printJobStatus: null }, { printJobStatus: "FAILED" }];
    const claim = await prisma.order.updateMany({ where: { id: orderId, OR: claimable }, data: { printJobStatus: "SUBMITTING" } });
    if (claim.count === 0) return { ok: true, state: "already" };

    try {
      const { buildPodPackageId } = await import("@/lib/lulu-config");
      const { resolveFormatPrice } = await import("@/lib/book-visibility");
      const { getPublicSiteUrl } = await import("@/lib/seo/site-url");
      const { countryToIso2 } = await import("@/lib/user-country");
      const siteUrl = getPublicSiteUrl();

      type PrintLine = {
        format: string | null;
        grossAmount: unknown;
        book: {
          title: string; coverImageUrl: string | null; submissionMetadata: unknown;
          files: { kind: string; url: string }[];
        } & Record<string, unknown>;
      };

      const jobLines: LuluJobLine[] = (printLines as unknown as PrintLine[]).map((l) => {
        const meta = (l.book.submissionMetadata as {
          trimSizeCode?: string; interiorColor?: string; printQuality?: string; binding?: string;
          paperType?: string; coverFinish?: string; linenColor?: string; foilColor?: string;
          frontCoverImageUrl?: string;
        } | null) ?? null;
        const podPackageId = toLuluPodPackageId(buildPodPackageId({
          trimCode: meta?.trimSizeCode || "0600X0900",
          colorCode: meta?.interiorColor || "BW",
          qualityCode: meta?.printQuality || "STD",
          bindingCode: l.format === "hardcover" ? "LW" : (meta?.binding || "PB"),
          paperCode: meta?.paperType || "060UW444",
          finishCode: meta?.coverFinish || "M",
          linenCode: meta?.linenColor || "X",
          foilCode: meta?.foilColor || "X",
        }));
        const manuscript = l.book.files.find((f) => f.kind === "MANUSCRIPT");

        // The order stores one line per book with the total paid for all
        // copies; the number of copies is that total over the unit price.
        const unit = resolveFormatPrice(l.book as never, l.format === "hardcover" ? "hardcover" : "paperback");
        const gross = Number(l.grossAmount);
        const quantity = unit && unit > 0 && gross > 0 ? Math.max(1, Math.round(gross / unit)) : 1;

        return {
          title: l.book.title,
          podPackageId,
          coverUrl: absoluteFileUrl(meta?.frontCoverImageUrl || l.book.coverImageUrl, siteUrl) ?? "",
          interiorUrl: absoluteFileUrl(manuscript?.url, siteUrl) ?? "",
          quantity,
        };
      });

      const iso = countryToIso2(order.shipCountry) ?? "";
      const address = buildLuluAddress({
        name: order.shipName || order.reader.user.name,
        email: order.reader.user.email,
        rawAddress: order.shipAddress,
        countryIso: iso,
        phone: order.shipPhone,
      });

      const problems = [...shippingProblems(address), ...jobLines.flatMap(lineProblems)];
      if (problems.length > 0) {
        const message = `Not sent to Lulu — ${problems.join("; ")}.`;
        await markFailed(orderId, message);
        return { ok: false, state: "failed", error: message };
      }

      // Lulu emails job updates to contact_email; use the store's own
      // address so problems reach the team, not the customer.
      const result = await submitLuluPrintJob(jobLines, address, order.id, "support@thegoodchildbookstore.com");
      if (!result.ok) {
        await markFailed(orderId, result.error ?? "Unknown error");
        return { ok: false, state: "failed", error: result.error };
      }

      await prisma.order.update({
        where: { id: orderId },
        data: { printJobStatus: "SUBMITTED", printJobId: result.luluJobId ?? null, printJobError: null },
      });
      return { ok: true, state: "submitted" };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error while preparing the print job.";
      await markFailed(orderId, message);
      return { ok: false, state: "failed", error: message };
    }
  } catch (e) {
    console.error("Lulu print job submission threw for order", orderId, e);
    return { ok: false, state: "failed", error: e instanceof Error ? e.message : "Unexpected error." };
  }
}
