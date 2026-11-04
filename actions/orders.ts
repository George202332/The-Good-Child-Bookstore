"use server";

import { cookies } from "next/headers";
import { isAffiliateSaleFor } from "@/lib/affiliate-eligibility";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calculateSplits, applyAuthorReferralCarveOut } from "@/lib/revenue";
import { getCommissionRates, tierForReferralCount } from "@/lib/commission-settings";
import { generateAccountNumber } from "@/lib/account-number";
import { getRequestGeo } from "@/lib/geo";
import { getAccountCountry } from "@/lib/visitor-country";
import { countryToIso2 } from "@/lib/user-country";
import { restrictionMessage } from "@/lib/book-country-restriction";
import {
  effectiveRestrictedCountries,
  isFormatPurchasable,
  isLineRestricted,
  isSellOnStoreDisabled,
  resolveFormatPrice,
  type SaleFormat,
} from "@/lib/book-visibility";

/**
 * Runtime shape validation for checkout input — a Server Action is a
 * real HTTP endpoint under the hood, callable with any JSON body a
 * client sends, not just what a well-behaved browser sends through the
 * real checkout form. TypeScript's own types are erased at build time
 * and give zero runtime protection; this is the actual gate.
 *
 * Note this only validates *shape* (right types, sane ranges) — the
 * price itself is never trusted from the client at all; see
 * resolveFormatPrice() (lib/book-visibility.ts), which always looks the real price up fresh
 * from the database by bookId, ignoring anything the client sent for it.
 */
const orderItemSchema = z.object({
  bookId: z.string().min(1),
  qty: z.number().int().min(1).max(50),
  format: z.enum(["ebook", "paperback", "hardcover", "audiobook"]),
});
const createPendingOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1).max(50),
  guestEmail: z.string().email().optional(),
  guestName: z.string().min(1).max(200).optional(),
  shipName: z.string().max(200).optional(),
  shipPhone: z.string().max(50).optional(),
  shipCountry: z.string().max(100).optional(),
  shipAddress: z.string().max(1000).optional(),
  shippingLevel: z.string().max(30).optional(),
  /** The sealed quote the customer was shown (lib/shipping-quote-token.ts) and the price displayed with it. */
  shippingQuoteToken: z.string().max(1000).optional(),
  shippingAmountShown: z.number().min(0).max(100000).optional(),
  fulfillmentAmountShown: z.number().min(0).max(100000).optional(),
});

/**
 * Order creation: creates an Order + one SaleLine per book, with the
 * confirmed revenue split (see docs/architecture.md) computed and stored
 * permanently on each line. Every Order still belongs to a ReaderProfile
 * (kept, since orders/wallets/admin transactions all assume that
 * relationship) — but getting one is now automatic and invisible:
 *
 *   - Signed in as Author/Affiliate/anything else without a reader
 *     profile yet? One is created for that same account on the spot —
 *     no separate signup, no role change, same pattern as the
 *     reader-to-affiliate upgrade (see actions/reader-affiliate.ts).
 *   - Not signed in at all? A lightweight account is found-or-created
 *     from the email/name entered at checkout, so a genuine guest never
 *     has to make an account or set a password before buying — this is
 *     real guest checkout, not just a UI illusion.
 *
 * Book lookups now come from the real database (any published book,
 * not just the 50-book demo catalog fixture) — previously a real
 * submitted book could show up in the shop but silently fail to
 * actually check out.
 *
 * Split into createPendingOrder() + confirmOrderPaidDirectly() so a real
 * payment gateway can sit between the two (see actions/payment-init.ts):
 * create the Order as PENDING, send the buyer to Paystack, and
 * only mark it PAID once the gateway (or its webhook) confirms payment.
 * When no gateway is configured, checkout falls back to calling
 * confirmOrderPaidDirectly() immediately — the same demo-mode behavior
 * this app has had all along.
 */

export interface OrderItemInput {
  bookId: string;
  qty: number;
  /** Which of the 4 purchasable formats — determines both the real price
   * charged (Book.ebookPrice/paperbackPrice/hardcoverPrice/audiobookPrice)
   * and what's recorded on the resulting SaleLine. */
  format: "ebook" | "paperback" | "hardcover" | "audiobook";
}

export interface CreateOrderResult {
  ok: boolean;
  error?: string;
  orderId?: string;
  totalAmount?: number;
  /** True when the postage changed since the customer saw it; the checkout then asks again and shows the new price. */
  shippingChanged?: boolean;
  /** True when Lulu's printing price could not be confirmed: the checkout re-asks and keeps Pay switched off until it can. */
  priceUnavailable?: boolean;
}

/** Finds the current session's reader profile, or creates one for them
 * (any role) — or, for a guest, finds-or-creates a lightweight account
 * from the checkout email/name. Never returns null: the only failure
 * mode is a missing guest email with no session at all. */
async function resolveReaderProfileId(guestEmail?: string, guestName?: string): Promise<{ readerProfileId?: string; error?: string; isNewAccount?: boolean }> {
  const session = await auth();

  // Any signed-in account — Reader or Author — checks out under its own
  // identity, so the order lands in that same account's order history.
  // Authors now get the full storefront nav inside their own account
  // (see components/SiteChrome.tsx) specifically so they can shop
  // without switching accounts; an Author's User row has no
  // ReaderProfile yet the first time this runs, so one is created
  // lazily right here, the same way a first-time guest checkout gets one.
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { readerProfile: true } });
    if (!user) return { error: "Account not found." };
    if (user.readerProfile) return { readerProfileId: user.readerProfile.id };

    const readerProfile = await prisma.readerProfile.create({ data: { userId: user.id } });
    return { readerProfileId: readerProfile.id };
  }

  const email = guestEmail?.trim().toLowerCase();
  if (!email) return { error: "An email address is required to check out." };

  const existing = await prisma.user.findUnique({ where: { email }, include: { readerProfile: true } });
  if (existing) {
    if (existing.readerProfile) return { readerProfileId: existing.readerProfile.id };
    const readerProfile = await prisma.readerProfile.create({ data: { userId: existing.id } });
    return { readerProfileId: readerProfile.id };
  }

  // A first-time guest. No password is ever emailed: the account gets a random
  // password nobody knows (so it cannot be logged into yet) and is flagged
  // guestSetupPending. Once the order is confirmed paid, the purchase email
  // carries a one-time "set your password" link (lib/email/purchase.ts).
  const accountNumber = await generateAccountNumber("READER");
  const unusablePassword = randomBytes(32).toString("hex");
  const passwordHash = await bcrypt.hash(unusablePassword, 10);
  try {
    const guestUser = await prisma.user.create({
      data: {
        accountNumber,
        email,
        name: guestName?.trim() || "Guest",
        passwordHash,
        role: "READER",
        guestSetupPending: true,
        // The guest proves they own this address by using the emailed link, so
        // the signup email-verification gate would only lock them out of the
        // dashboard they just paid for; mark it verified at creation.
        emailVerifiedAt: new Date(),
        readerProfile: { create: {} },
      },
      include: { readerProfile: true },
    });
    return { readerProfileId: guestUser.readerProfile!.id, isNewAccount: true };
  } catch (e) {
    // Two checkouts for the same new email at the same moment: the database
    // allows only one account per email, so the loser simply uses the winner's.
    if ((e as { code?: string })?.code === "P2002") {
      const winner = await prisma.user.findUnique({ where: { email }, include: { readerProfile: true } });
      if (winner) {
        if (winner.readerProfile) return { readerProfileId: winner.readerProfile.id };
        const rp = await prisma.readerProfile.create({ data: { userId: winner.id } });
        return { readerProfileId: rp.id };
      }
    }
    throw e;
  }
}

export async function createPendingOrder(input: {
  items: OrderItemInput[];
  guestEmail?: string;
  guestName?: string;
  shipName?: string;
  shipPhone?: string;
  shipCountry?: string;
  shipAddress?: string;
  /** Shipping method chosen for printed copies (a Lulu shipping_level). */
  shippingLevel?: string;
  /** The sealed quote shown at checkout, and the amount displayed with it. */
  shippingQuoteToken?: string;
  shippingAmountShown?: number;
  fulfillmentAmountShown?: number;
}): Promise<CreateOrderResult> {
  const parsed = createPendingOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That order couldn't be processed — please refresh your cart and try again." };
  }
  input = parsed.data;

  // Validate every line BEFORE any account is created or order written, so a
  // rejected checkout leaves nothing behind (no stray guest account).
  const bookIds = input.items.map((i) => i.bookId);
  const books = await prisma.book.findMany({ where: { id: { in: bookIds } }, include: { author: true, files: true } });
  if (input.items.length === 0) return { ok: false, error: "Your cart is empty." };

  const geo = await getRequestGeo();
  const accountCountry = await getAccountCountry();
  const shipIso = countryToIso2(input.shipCountry);
  const FORMAT_NAME: Record<SaleFormat, string> = { ebook: "eBook", paperback: "Paperback", hardcover: "Hardcover", audiobook: "Audiobook" };

  const lines: { bookId: string; qty: number; format: SaleFormat; book: (typeof books)[number]; unitPrice: number }[] = [];
  for (const item of input.items) {
    const book = books.find((b) => b.id === item.bookId);
    if (!book || book.status !== "PUBLISHED" || isSellOnStoreDisabled(book.submissionMetadata)) {
      return { ok: false, error: `${book ? `"${book.title}"` : "A book in your cart"} is no longer available. Please remove it and try again.` };
    }
    // Authoritative country restriction: account country OR request geo, and
    // the ship-to country for print lines. Unknown countries never restrict.
    if (isLineRestricted(effectiveRestrictedCountries(book), { accountCountry, geoCountry: geo.country, shipCountry: shipIso }, item.format)) {
      return { ok: false, error: `${book.title}: ${restrictionMessage}` };
    }
    // The requested format must really be on sale for this book — and an
    // audiobook with no price of its own is rejected, never charged at the
    // eBook (or base) price.
    const unitPrice = resolveFormatPrice(book, item.format);
    if (!isFormatPurchasable(book, item.format) || unitPrice === null) {
      return { ok: false, error: `"${book.title}" isn't available as ${FORMAT_NAME[item.format]}. Please remove it from your cart and try again.` };
    }
    lines.push({ ...item, book, unitPrice });
  }

  // Printed copies are made and shipped by Lulu, which needs a complete
  // delivery address and contact details. Check them here, before anyone is
  // charged, so an order can never reach Lulu half-filled. (The checkout
  // page asks for every one of these; this is the authoritative check.)
  const hasPrintLine = lines.some((l) => l.format === "paperback" || l.format === "hardcover");
  let shippingLevel: string | null = null;
  // What the customer pays for postage (the store never absorbs it).
  let shippingAmount: number | null = null;
  // The exact quote used for this order (saved on the order).
  let shippingQuoteRecord: Record<string, unknown> | null = null;
  // Lulu's quoted production printing cost per printed line, and its shipping / fulfilment charges.
  const printingCostByLine = new Map<(typeof lines)[number], number>();
  let luluShippingCost: number | null = null;
  let luluFulfillmentCost: number | null = null;
  // What the customer pays for Lulu's per-order fulfillment fee (a pass-through, like postage).
  let fulfillmentAmount: number | null = null;
  if (hasPrintLine) {
    const { buildLuluAddress, shippingProblems } = await import("@/lib/lulu-order");
    const addr = buildLuluAddress({
      name: input.shipName || input.guestName || "",
      email: input.guestEmail ?? "x@x.x",
      rawAddress: input.shipAddress,
      countryIso: shipIso ?? "",
      phone: input.shipPhone,
    });
    // The email is taken from the account when signed in, so it is not part of this check.
    const problems = shippingProblems({ ...addr, email: "ok" });
    if (!addr.phone_number) problems.push("a phone number is required for delivery");
    if (problems.length > 0) {
      return { ok: false, error: `Printed copies need a complete delivery address: ${problems.join("; ")}.` };
    }
    const { getEnabledShippingLevels } = await import("@/lib/api-keys");
    const { resolveShippingLevel } = await import("@/lib/lulu-order");
    shippingLevel = resolveShippingLevel(input.shippingLevel, shipIso ?? "", await getEnabledShippingLevels());

    // Postage is worked out on the server, never taken from the browser. The checkout hands back the sealed quote it
    // showed (lib/shipping-quote-token.ts): when that is genuine, unexpired and for exactly these books, this address
    // and this method, the customer is charged EXACTLY that amount. Otherwise Lulu is asked again, and if the new
    // price differs from the one the customer saw, the order is not created and the checkout shows the new price.
    const { quoteCartShipping } = await import("@/lib/payments/cart-shipping");
    const { quoteFingerprint, openQuote } = await import("@/lib/shipping-quote-token");
    const { parseShipAddress } = await import("@/lib/lulu-order");
    const printForQuote = lines.filter((l) => l.format === "paperback" || l.format === "hardcover");
    const fp = quoteFingerprint({ items: printForQuote.map((l) => ({ bookId: l.bookId, qty: l.qty, format: l.format })), countryIso: shipIso ?? "", address: input.shipAddress });
    const sealed = openQuote(input.shippingQuoteToken, { level: shippingLevel, fp });
    let quote: { amount: number; source: "lulu" | "estimate"; minDays?: number; maxDays?: number } | undefined;
    if (sealed) {
      quote = { amount: sealed.amount, source: "lulu", minDays: sealed.minDays, maxDays: sealed.maxDays };
    } else {
      const [fresh] = await quoteCartShipping({
        lines: lines.map((l) => ({ title: l.book.title, format: l.format, qty: l.qty, submissionMetadata: l.book.submissionMetadata, files: l.book.files })),
        countryIso: shipIso ?? "",
        rawAddress: input.shipAddress,
        phone: input.shipPhone,
        name: input.shipName || input.guestName,
        levels: [shippingLevel as import("@/lib/lulu-order").LuluShippingLevel],
      });
      quote = fresh;
      if (fresh && fresh.source === "lulu" && typeof input.shippingAmountShown === "number" && Math.abs(fresh.amount - input.shippingAmountShown) > 0.005) {
        return {
          ok: false,
          shippingChanged: true,
          error: `The shipping price for your address changed from $${input.shippingAmountShown.toFixed(2)} to $${fresh.amount.toFixed(2)}. Your total has been updated; please review it and press pay again.`,
        };
      }
    }
    shippingAmount = quote ? quote.amount : 0;
    shippingQuoteRecord = quote
      ? {
          level: shippingLevel,
          amount: quote.amount,
          source: quote.source,
          minDays: quote.minDays ?? null,
          maxDays: quote.maxDays ?? null,
          quotedAt: new Date().toISOString(),
          sealedQuoteUsed: !!sealed,
          country: shipIso ?? "",
          postcode: parseShipAddress(input.shipAddress).postcode,
        }
      : null;

    // The customer is charged EXACTLY what Lulu quotes for this address and method: an estimate
    // is never charged. If Lulu cannot quote this method for this address, the order is not
    // created (the checkout page only offers methods Lulu has priced for the address).
    const { luluIsConfigured, quoteLuluCosts } = await import("@/lib/payments/lulu");
    if (!(await luluIsConfigured())) {
      return { ok: false, error: "Printed copies can't be ordered right now. Please try again later." };
    }
    if (!quote || quote.source !== "lulu") {
      return { ok: false, error: "Lulu could not quote shipping for this address and method. Please check the address or choose another shipping method." };
    }

    // Lulu's production printing cost for each printed line, from Lulu's own cost calculator,
    // saved on the sale line below so the royalty always matches what Lulu quoted at the time
    // and is never recalculated later. Shipping is kept apart and never enters the split.
    const printLines = lines.filter((l) => l.format === "paperback" || l.format === "hardcover");
    const costAddress = buildLuluAddress({
      name: input.shipName || input.guestName || "Customer",
      email: "quote@thegoodchildbookstore.com",
      rawAddress: input.shipAddress,
      countryIso: shipIso ?? "",
      phone: input.shipPhone,
    });
    const costs = await quoteLuluCosts(
      printLines.map((l) => ({
        title: l.book.title,
        format: l.format as "paperback" | "hardcover",
        quantity: l.qty,
        submissionMetadata: l.book.submissionMetadata,
        manuscriptUrl: l.book.files.find((f: { kind: string; url: string }) => f.kind === "MANUSCRIPT")?.url,
      })),
      costAddress,
      shippingLevel as import("@/lib/lulu-order").LuluShippingLevel,
    );
    if (!costs.ok) {
      // Say exactly what went wrong (and alert the team when it is on our side) instead of a vague "try again".
      const { needsTeamAlert } = await import("@/lib/lulu-quote-failure");
      if (needsTeamAlert(costs.failure.kind)) {
        const { reportSystemError } = await import("@/lib/site-health/alert");
        await reportSystemError("CHECKOUT", new Error(`Order could not be created: Lulu's printing price was not available (${costs.failure.kind}${costs.failure.status ? `, HTTP ${costs.failure.status}` : ""}): ${costs.failure.detail || "no detail"}`), {}).catch(() => undefined);
      }
      return { ok: false, priceUnavailable: true, error: costs.failure.customerMessage };
    }
    printLines.forEach((l, i) => printingCostByLine.set(l, costs.quote.lineCosts[i]));
    luluShippingCost = costs.quote.shippingCost;
    luluFulfillmentCost = costs.quote.fulfillmentCost;
    // Lulu's fulfillment fee is charged to the customer, exactly as quoted, once per order. If it is not what the
    // checkout showed, the order is not created and the checkout shows the new figure.
    fulfillmentAmount = costs.quote.fulfillmentCost;
    if (typeof input.fulfillmentAmountShown === "number" && Math.abs(fulfillmentAmount - input.fulfillmentAmountShown) > 0.005) {
      return {
        ok: false,
        shippingChanged: true,
        error: `The fulfillment fee for your order changed from $${input.fulfillmentAmountShown.toFixed(2)} to $${fulfillmentAmount.toFixed(2)}. Your total has been updated; please review it and press pay again.`,
      };
    }
  }

  const { readerProfileId, error } = await resolveReaderProfileId(input.guestEmail, input.guestName);
  if (!readerProfileId) {
    return { ok: false, error: error ?? "Couldn't start checkout." };
  }

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);

  // Real affiliate attribution: the "which affiliate link was this visit
  // through" cookie is set directly in middleware (proxy.ts) — reliable
  // on every request, unlike the earlier client-side-effect approach.
  // Only the specific book that link points to gets the affiliate split
  // and gets linked back to that AffiliateLink — every other line in the
  // same order is an ordinary organic sale. The link is looked up fresh
  // here (not trusted from the cookie) so its real, current bookId/
  // affiliateId are always used.
  let affiliateLinkId: string | null = null;
  let affiliateBookId: string | null = null;
  let affiliateLinkedBook: { id: string; authorId: string; title: string } | null = null;
  try {
    const cookieStore = await cookies();
    const affCode = cookieStore.get("gcb_aff")?.value;
    if (affCode) {
      const link = await prisma.affiliateLink.findUnique({ where: { code: affCode } });
      if (link) {
        affiliateLinkId = link.id;
        affiliateBookId = link.bookId;
        // The link points at one record, but works for every eligible edition of that title.
        affiliateLinkedBook = link.bookId ? await prisma.book.findUnique({ where: { id: link.bookId }, select: { id: true, authorId: true, title: true } }) : null;
      }
    }
  } catch {
    // malformed/missing cookie — treat as no attribution
  }

  // Books plus postage. Postage is not part of any line, so it never enters
  // the author / affiliate / company split.
  const { orderTotalWithShipping } = await import("@/lib/shipping-quote");
  const totalAmount = orderTotalWithShipping(+subtotal.toFixed(2), shippingAmount ?? 0, fulfillmentAmount ?? 0);
  const commissionRates = await getCommissionRates();

  // Referral commission is tiered (Hawk/Falcon/Eagle/Phoenix — see
  // lib/commission-settings.ts): each referring affiliate's rate
  // depends on how many authors THEY'VE referred, not a single flat
  // rate for everyone. Since Prisma's nested `create` array must be
  // built synchronously, every unique referring affiliate's current
  // count (and therefore rate) is looked up once, up front.
  const referringAffiliateIds = Array.from(
    new Set(lines.map((l) => l.book.author.referredById).filter((id): id is string => !!id))
  );
  const referralPctByAffiliateId = new Map<string, number>();
  for (const affiliateId of referringAffiliateIds) {
    const count = await prisma.authorProfile.count({ where: { referredById: affiliateId } });
    referralPctByAffiliateId.set(affiliateId, tierForReferralCount(count, commissionRates.tiers).pct);
  }

  const { getSiteDataMode } = await import("@/actions/test-data");
  const siteMode = await getSiteDataMode();

  // Retries, double clicks and switching between PayPal and card must never create a second order for the same
  // purchase: when this reader already has an unpaid order for exactly these books, address, method and total that was
  // created a moment ago, it is reused.
  {
    const { sameOrderLines, PENDING_REUSE_MINUTES } = await import("@/lib/pending-order");
    const waiting = await prisma.order.findMany({
      where: {
        readerId: readerProfileId,
        status: "PENDING",
        shippingLevel,
        shipAddress: input.shipAddress?.trim() || null,
        createdAt: { gte: new Date(Date.now() - PENDING_REUSE_MINUTES * 60 * 1000) },
        paymentLogs: { none: {} },
      },
      select: { id: true, totalAmount: true, lines: { select: { bookId: true, format: true, grossAmount: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    const wanted = lines.map((l) => ({ bookId: l.bookId, format: l.format as string | null, gross: +(l.unitPrice * l.qty).toFixed(2) }));
    const same = waiting.find((o) => Math.abs(Number(o.totalAmount) - totalAmount) < 0.005
      && sameOrderLines(o.lines.map((l) => ({ bookId: l.bookId, format: l.format, gross: Number(l.grossAmount) })), wanted));
    if (same) return { ok: true, orderId: same.id, totalAmount };
  }

  let order: { id: string };
  try {
  order = await prisma.order.create({
    data: {
      readerId: readerProfileId,
      status: "PENDING",
      totalAmount,
      isTestData: siteMode === "test",
      country: geo.country,
      region: geo.region,
      shipName: input.shipName?.trim() || null,
      shipPhone: input.shipPhone?.trim() || null,
      shipCountry: input.shipCountry?.trim() || null,
      shipAddress: input.shipAddress?.trim() || null,
      shippingLevel,
      shippingAmount,
      shippingQuote: shippingQuoteRecord ? (JSON.parse(JSON.stringify(shippingQuoteRecord)) as object) : undefined,
      luluShippingCost,
      luluFulfillmentCost,
      fulfillmentAmount,
      lines: {
        create: lines.map((l) => {
          const lineGross = +(l.unitPrice * l.qty).toFixed(2);
          const isAffiliateSale = affiliateBookId !== null && isAffiliateSaleFor(affiliateLinkedBook, { id: l.bookId, authorId: l.book.authorId, title: l.book.title, submissionMetadata: l.book.submissionMetadata }, l.format);
          // Printed copies: Lulu's printing cost comes off the price before anything is split.
          const printingCost = printingCostByLine.get(l) ?? null;
          let split = calculateSplits(lineGross, isAffiliateSale, commissionRates.promotionPct, printingCost ?? 0);
          const referredById = l.book.author.referredById;
          if (referredById) split = applyAuthorReferralCarveOut(split, referralPctByAffiliateId.get(referredById) ?? 0);
          return {
            bookId: l.bookId,
            format: l.format,
            affiliateLinkId: isAffiliateSale ? affiliateLinkId : null,
            saleType: split.saleType,
            grossAmount: split.gross,
            printingCost,
            companyShare: split.companyShare,
            authorShare: split.authorShare,
            affiliateShare: split.affiliateShare,
            authorReferralShare: split.authorReferralShare,
            authorReferralAffiliateId: referredById ?? null,
          };
        }),
      },
    },
  });
  } catch (e) {
    // The order could not be saved (for example the database is a step behind the code). Say so plainly instead of leaving
    // the checkout spinning, tell the team, and keep the reason in the server log (never any key).
    const code = (e as { code?: string } | null)?.code ?? "unknown";
    console.error(`[checkout] the order could not be saved (${code}):`, e instanceof Error ? e.message.split("\n").slice(-3).join(" ").replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[address hidden]").slice(0, 400) : "unknown error");
    const { reportSystemError } = await import("@/lib/site-health/alert");
    await reportSystemError("DATABASE", e instanceof Error ? e : new Error(String(e)), { step: "createPendingOrder", code }).catch(() => undefined);
    return { ok: false, error: "We couldn't save your order just now, so nothing has been charged. Please try again in a few minutes; our team has been told." };
  }

  return { ok: true, orderId: order.id, totalAmount };
}

/** Demo-mode fallback: marks an order PAID directly, without a real
 * payment gateway. Used when no Paystack credentials are
 * configured (see actions/payment-init.ts initiateGatewayCheckout). */
export async function confirmOrderPaidDirectly(orderId: string): Promise<{ ok: boolean }> {
  // Guards for this demo-only path: it can never be used to mark an order
  // paid while a real gateway is configured, never re-confirms an order, and
  // re-checks country restrictions so it cannot be a way around
  // createPendingOrder's authoritative block.
  // There is no demo checkout on the live site: it only works when
  // ALLOW_DEMO_CHECKOUT=1 is set (local development), and never while a real
  // gateway (Paystack or PayPal) is configured.
  if (process.env.ALLOW_DEMO_CHECKOUT !== "1") return { ok: false };
  const { getPaystackCredentials, getPaypalCredentials } = await import("@/lib/api-keys");
  if ((await getPaystackCredentials()).secretKey) return { ok: false };
  if ((await getPaypalCredentials()).clientId) return { ok: false };

  const pending = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: { include: { book: true } } },
  });
  if (!pending) return { ok: false };
  if (pending.status !== "PENDING") return { ok: pending.status === "PAID" };

  const geo = await getRequestGeo();
  const accountCountry = await getAccountCountry();
  const shipIso = countryToIso2(pending.shipCountry);
  const blocked = pending.lines.some((l) =>
    isLineRestricted(
      effectiveRestrictedCountries(l.book),
      { accountCountry, geoCountry: geo.country ?? pending.country, shipCountry: shipIso },
      l.format,
    )
  );
  if (blocked) {
    await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
    return { ok: false };
  }

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: "PAID" },
    include: { reader: { include: { user: true } } },
  });
  try {
    await prisma.notification.create({
      data: {
        userId: order.reader.user.id,
        title: `Payment received: Order #${orderId.slice(0, 8).toUpperCase()}`,
        body: `Your order #${orderId.slice(0, 8).toUpperCase()} for $${Number(order.totalAmount).toFixed(2)} is confirmed.`,
        type: "PAYMENT",
        // Tied to the order so deleting the order removes this too.
        relatedRecordId: orderId,
      },
    });
  } catch {
    // Non-critical.
  }

  // Notifies the author of each line's book ("You've got a sale" on
  // their Recent Activity, plus the Revenue-tab blink), and any
  // referring/promoting affiliate of their own commission — see
  // lib/payments/notify-earners.ts. This demo-mode confirmation path
  // previously never did any of this at all (only the real-gateway
  // path in lib/payments/finalize.ts did, and even that one never
  // notified affiliates) — now both paths share the exact same logic.
  const { notifyRevenueEarners } = await import("@/lib/payments/notify-earners");
  await notifyRevenueEarners(orderId);

  // Any physical copies in this order get submitted to Lulu as a real
  // print-on-demand job — never allowed to block or undo the order
  // confirmation itself if it fails, since the customer's payment
  // already succeeded.
  const { submitPrintJobsForOrder } = await import("@/lib/payments/lulu");
  await submitPrintJobsForOrder(orderId);

  const { sendOrderReceiptEmail } = await import("@/actions/order-emails");
  await sendOrderReceiptEmail(orderId);
  return { ok: true };
}
