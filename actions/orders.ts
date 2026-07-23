"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calculateSplits } from "@/lib/revenue";
import { BOOKS } from "@/lib/data/catalog";

/**
 * Order creation: creates an Order + one SaleLine per book, with the
 * confirmed revenue split (see docs/architecture.md) computed and stored
 * permanently on each line — this is what the original prototype's
 * completeCheckoutOrder() only ever simulated in localStorage. Requires a
 * signed-in reader; guest checkout isn't modeled in the schema yet (every
 * Order belongs to a ReaderProfile).
 *
 * Split into createPendingOrder() + confirmOrderPaidDirectly() so a real
 * payment gateway can sit between the two (see actions/payment-init.ts):
 * create the Order as PENDING, send the buyer to PayPal/Paystack, and
 * only mark it PAID once the gateway (or its webhook) confirms payment.
 * When no gateway is configured, checkout falls back to calling
 * confirmOrderPaidDirectly() immediately — the same demo-mode behavior
 * this app has had all along.
 */

export interface OrderItemInput {
  bookId: string;
  qty: number;
}

export interface CreateOrderResult {
  ok: boolean;
  error?: string;
  orderId?: string;
  totalAmount?: number;
}

export async function createPendingOrder(input: {
  items: OrderItemInput[];
  couponDiscountPct?: number;
}): Promise<CreateOrderResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, error: "You need to be signed in to place an order." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { readerProfile: true } });
  if (!user?.readerProfile) {
    return { ok: false, error: "Only reader accounts can place orders." };
  }

  const lines = input.items
    .map((i) => ({ ...i, book: BOOKS.find((b) => b.id === i.bookId) }))
    .filter((l): l is typeof l & { book: NonNullable<typeof l.book> } => !!l.book);

  if (lines.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

  const subtotal = lines.reduce((sum, l) => sum + l.book.price * l.qty, 0);
  const couponPct = input.couponDiscountPct ?? 0;

  // Real affiliate attribution: recordAffiliateClick() (actions/affiliate.ts)
  // sets this cookie when someone visits a book page through a promotional
  // link. Only the specific book that was clicked gets the affiliate split
  // and gets linked back to that AffiliateLink — every other line in the
  // same order is an ordinary organic sale.
  let affiliateLinkId: string | null = null;
  let affiliateBookId: string | null = null;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("gcb_aff")?.value;
    if (raw) {
      const parsed = JSON.parse(raw) as { linkId: string; bookId: string | null };
      affiliateLinkId = parsed.linkId;
      affiliateBookId = parsed.bookId;
    }
  } catch {
    // malformed/missing cookie — treat as no attribution
  }

  const totalAmount = +(subtotal * (1 - couponPct)).toFixed(2);

  const order = await prisma.order.create({
    data: {
      readerId: user.readerProfile.id,
      status: "PENDING",
      totalAmount,
      lines: {
        create: lines.map((l) => {
          const lineGross = +(l.book.price * l.qty * (1 - couponPct)).toFixed(2);
          const isAffiliateSale = affiliateBookId !== null && affiliateBookId === l.bookId;
          const split = calculateSplits(lineGross, isAffiliateSale);
          return {
            bookId: l.bookId,
            affiliateLinkId: isAffiliateSale ? affiliateLinkId : null,
            saleType: split.saleType,
            grossAmount: split.gross,
            companyShare: split.companyShare,
            authorShare: split.authorShare,
            affiliateShare: split.affiliateShare,
          };
        }),
      },
    },
  });

  return { ok: true, orderId: order.id, totalAmount };
}

/** Demo-mode fallback: marks an order PAID directly, without a real
 * payment gateway. Used when no PayPal/Paystack credentials are
 * configured (see actions/payment-init.ts initiateGatewayCheckout). */
export async function confirmOrderPaidDirectly(orderId: string): Promise<{ ok: boolean }> {
  await prisma.order.update({ where: { id: orderId }, data: { status: "PAID" } });
  return { ok: true };
}

export interface OrderSummary {
  id: string;
  totalAmount: number;
  items: { title: string; price: number }[];
}

/** Fetches an order for the confirmation page — used both by the demo-mode
 * path and the real gateway return flow (app/checkout/return). */
export async function getOrderSummary(orderId: string): Promise<OrderSummary | null> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { lines: { include: { book: true } } },
    });
    if (!order || !Array.isArray(order.lines)) return null;
    return {
      id: order.id,
      totalAmount: Number(order.totalAmount),
      items: order.lines.map((l: { book: { title: string }; grossAmount: unknown }) => ({
        title: l.book.title,
        price: Number(l.grossAmount),
      })),
    };
  } catch {
    return null;
  }
}
