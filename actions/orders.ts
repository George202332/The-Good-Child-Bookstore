"use server";

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calculateSplits, applyAuthorReferralCarveOut } from "@/lib/revenue";
import { getCommissionRates, tierForReferralCount } from "@/lib/commission-settings";
import { generateAccountNumber } from "@/lib/account-number";
import { getRequestGeo } from "@/lib/geo";

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
}

/** Finds the current session's reader profile, or creates one for them
 * (any role) — or, for a guest, finds-or-creates a lightweight account
 * from the checkout email/name. Never returns null: the only failure
 * mode is a missing guest email with no session at all. */
async function resolveReaderProfileId(guestEmail?: string, guestName?: string): Promise<{ readerProfileId?: string; error?: string }> {
  const session = await auth();

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

  const accountNumber = await generateAccountNumber("READER");
  const passwordHash = await bcrypt.hash(`guest-${Date.now()}-${Math.random()}`, 10);
  const guestUser = await prisma.user.create({
    data: {
      accountNumber,
      email,
      name: guestName?.trim() || "Guest",
      passwordHash,
      role: "READER",
      readerProfile: { create: {} },
    },
    include: { readerProfile: true },
  });
  return { readerProfileId: guestUser.readerProfile!.id };
}

export async function createPendingOrder(input: {
  items: OrderItemInput[];
  couponDiscountPct?: number;
  guestEmail?: string;
  guestName?: string;
}): Promise<CreateOrderResult> {
  const { readerProfileId, error } = await resolveReaderProfileId(input.guestEmail, input.guestName);
  if (!readerProfileId) {
    return { ok: false, error: error ?? "Couldn't start checkout." };
  }

  const bookIds = input.items.map((i) => i.bookId);
  const books = await prisma.book.findMany({ where: { id: { in: bookIds } }, include: { author: true } });
  const lines = input.items
    .map((i) => ({ ...i, book: books.find((b: { id: string }) => b.id === i.bookId) }))
    .filter((l): l is typeof l & { book: NonNullable<typeof l.book> } => !!l.book);

  if (lines.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

  function priceForFormat(book: { price: unknown; ebookPrice: unknown; paperbackPrice: unknown; hardcoverPrice: unknown; audiobookPrice: unknown }, format: string): number {
    const perFormat =
      format === "ebook" ? book.ebookPrice :
      format === "paperback" ? book.paperbackPrice :
      format === "hardcover" ? book.hardcoverPrice :
      book.audiobookPrice;
    return perFormat !== null && perFormat !== undefined ? Number(perFormat) : Number(book.price);
  }

  const subtotal = lines.reduce((sum, l) => sum + priceForFormat(l.book, l.format) * l.qty, 0);
  const couponPct = input.couponDiscountPct ?? 0;

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
  try {
    const cookieStore = await cookies();
    const affCode = cookieStore.get("gcb_aff")?.value;
    if (affCode) {
      const link = await prisma.affiliateLink.findUnique({ where: { code: affCode } });
      if (link) {
        affiliateLinkId = link.id;
        affiliateBookId = link.bookId;
      }
    }
  } catch {
    // malformed/missing cookie — treat as no attribution
  }

  const totalAmount = +(subtotal * (1 - couponPct)).toFixed(2);
  const commissionRates = await getCommissionRates();
  const geo = await getRequestGeo();

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

  const order = await prisma.order.create({
    data: {
      readerId: readerProfileId,
      status: "PENDING",
      totalAmount,
      country: geo.country,
      region: geo.region,
      lines: {
        create: lines.map((l) => {
          const lineGross = +(priceForFormat(l.book, l.format) * l.qty * (1 - couponPct)).toFixed(2);
          const isAffiliateSale = affiliateBookId !== null && affiliateBookId === l.bookId;
          let split = calculateSplits(lineGross, isAffiliateSale, commissionRates.promotionPct);
          const referredById = l.book.author.referredById;
          if (referredById) split = applyAuthorReferralCarveOut(split, referralPctByAffiliateId.get(referredById) ?? 0);
          return {
            bookId: l.bookId,
            format: l.format,
            affiliateLinkId: isAffiliateSale ? affiliateLinkId : null,
            saleType: split.saleType,
            grossAmount: split.gross,
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

  return { ok: true, orderId: order.id, totalAmount };
}

/** Demo-mode fallback: marks an order PAID directly, without a real
 * payment gateway. Used when no Paystack credentials are
 * configured (see actions/payment-init.ts initiateGatewayCheckout). */
export async function confirmOrderPaidDirectly(orderId: string): Promise<{ ok: boolean }> {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: "PAID" },
    include: { reader: { include: { user: true } } },
  });
  try {
    await prisma.notification.create({
      data: {
        userId: order.reader.user.id,
        title: "Order confirmed",
        body: `Your order #${orderId.slice(0, 8).toUpperCase()} for $${Number(order.totalAmount).toFixed(2)} is confirmed.`,
      },
    });
  } catch {
    // Non-critical.
  }
  const { sendOrderReceiptEmail } = await import("@/actions/order-emails");
  await sendOrderReceiptEmail(orderId);
  return { ok: true };
}

export interface OrderSummary {
  id: string;
  totalAmount: number;
  items: { title: string; price: number; downloadUrl: string | null; hasEbook: boolean; hasAudiobook: boolean; coverImageUrl: string | null }[];
}

/** Fetches an order for the confirmation page — used both by the demo-mode
 * path and the real gateway return flow (app/checkout/return). Includes a
 * real download link for any purchased eBook that has a manuscript file
 * on record (see BookFile kind: "MANUSCRIPT") — the demo catalog's 50
 * seeded books don't have one (they were seeded directly, not submitted
 * through the real upload flow), so those show no download link, same
 * as any book an author hasn't actually uploaded a file for yet. */
export async function getOrderSummary(orderId: string): Promise<OrderSummary | null> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { lines: { include: { book: { include: { files: true } } } } },
    });
    if (!order || !Array.isArray(order.lines)) return null;
    return {
      id: order.id,
      totalAmount: Number(order.totalAmount),
      items: order.lines.map((l: {
        book: { title: string; hasEbook: boolean; hasAudiobook: boolean; coverImageUrl: string | null; files: { kind: string; url: string }[] };
        grossAmount: unknown;
      }) => ({
        title: l.book.title,
        price: Number(l.grossAmount),
        downloadUrl: l.book.files.find((f) => f.kind === "MANUSCRIPT")?.url ?? null,
        hasEbook: l.book.hasEbook,
        hasAudiobook: l.book.hasAudiobook,
        coverImageUrl: l.book.coverImageUrl,
      })),
    };
  } catch {
    return null;
  }
}
