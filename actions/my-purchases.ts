"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * "My purchases" — every payment the SIGNED-IN account personally made
 * as a customer (book orders, and subscriptions once those carry a
 * price of their own). This is deliberately the mirror image of
 * actions/author-transactions.ts (which is about money an Author
 * *receives*, i.e. sales of their own books plus payouts) — this file
 * is only ever about money the account holder *spent*. Used by both
 * the Reader's "Transactions" nav item and the Author's new
 * "Transactions" entry under Financial, since both roles resolve
 * through the same readerProfile mechanism (see resolveReaderProfileId
 * in actions/orders.ts — an Author who buys a book as a customer gets
 * a readerProfile on their own User row exactly like a Reader would).
 *
 * Note: the Subscription model (prisma/schema.prisma) doesn't carry a
 * price field yet, so there is currently nothing monetary to show for
 * subscriptions — only real book orders appear below. If priced
 * subscriptions are added later, they belong in this same list.
 */

export interface MyPurchaseRow {
  id: string;
  date: string;
  detail: string;
  method: string;
  amount: number;
  status: string;
}

const GATEWAY_LABEL: Record<string, string> = {
  PAYSTACK: "Paystack",
  STRIPE: "Stripe",
  PAYPAL: "PayPal",
  FLUTTERWAVE: "Flutterwave",
};

export async function getMyPurchases(): Promise<MyPurchaseRow[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      readerProfile: {
        include: {
          orders: {
            include: {
              lines: { include: { book: true } },
              paymentLogs: true,
            },
          },
        },
      },
    },
  });

  const orders = user?.readerProfile?.orders ?? [];

  type OrderWithLines = {
    id: string;
    createdAt: Date;
    totalAmount: unknown;
    status: string;
    lines: { book: { title: string } }[];
    paymentLogs: { gateway: string }[];
  };

  return (orders as OrderWithLines[])
    .map((o) => {
      const titles = o.lines.map((l) => l.book.title);
      const detail = titles.length === 0 ? "Order" : titles.length === 1 ? titles[0] : `${titles[0]} +${titles.length - 1} more`;
      const gateway = o.paymentLogs[0]?.gateway;
      return {
        id: o.id,
        date: o.createdAt.toISOString(),
        detail,
        method: gateway ? GATEWAY_LABEL[gateway] ?? gateway : "—",
        amount: Number(o.totalAmount),
        status: o.status,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
