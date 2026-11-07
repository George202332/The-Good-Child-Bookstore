import { prisma } from "@/lib/prisma";

export interface MyOrderLine { book: { title: string }; format: string | null }
export interface MyOrder {
  id: string;
  totalAmount: unknown;
  processingFeeAmount: unknown;
  status: string;
  createdAt: Date;
  printJobStatus: string | null;
  lines: MyOrderLine[];
}

/** An account's orders, newest first, naming only the columns the order pages need (so a column added by a newer
 * migration can never break them). Never throws: `failed` is true when the orders could not be read at all. */
export async function loadMyOrders(userId: string): Promise<{ orders: MyOrder[]; failed: boolean }> {
  try {
    const profile = await prisma.readerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) return { orders: [], failed: false };
    const orders = await prisma.order.findMany({
      where: { readerId: profile.id },
      select: {
        id: true, totalAmount: true, processingFeeAmount: true, status: true, createdAt: true, printJobStatus: true,
        lines: { select: { format: true, book: { select: { title: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return {
      orders: orders.map((o) => ({
        id: o.id, totalAmount: o.totalAmount, processingFeeAmount: o.processingFeeAmount, status: o.status, createdAt: o.createdAt, printJobStatus: o.printJobStatus,
        lines: o.lines.filter((l) => !!l.book).map((l) => ({ format: l.format, book: { title: l.book.title } })),
      })),
      failed: false,
    };
  } catch (e) {
    console.error("[orders] could not load an account's orders:", e instanceof Error ? e.message : e);
    return { orders: [], failed: true };
  }
}
