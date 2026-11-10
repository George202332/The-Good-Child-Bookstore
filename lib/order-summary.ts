import { prisma } from "@/lib/prisma";
import { messagesForOrder, orderMessageFee } from "@/lib/personal-message-db";

// SERVER-ONLY (not a "use server" action): the confirmation page reads an order here only AFTER it has checked the visitor
// holds the order's secret key or is its signed-in owner. Exposed as an action it could be called with any order number.

export interface OrderSummary {
  id: string;
  /** PENDING / PAID / FAILED / CANCELLED / REFUNDED: the confirmation page only celebrates PAID. */
  status: string;
  totalAmount: number;
  /** Postage the customer paid (included in totalAmount); 0 when none. */
  shippingAmount: number;
  /** Lulu's per-order fulfillment fee the customer paid (included in totalAmount); 0 when none. */
  fulfillmentAmount: number;
  /** The Processing Fee the customer paid on printed copies (included in totalAmount); 0 when none. */
  processingFeeAmount: number;
  /** The Personal Message fee the customer paid (included in totalAmount); 0 when none. */
  personalMessageFee: number;
  /** The Personal Messages on this order (printed lines only). */
  personalMessages: { saleLineId: string; bookTitle: string; text: string; style: string; status: string }[];
  printJobStatus: string | null;
  printJobError: string | null;
  items: { title: string; price: number; downloadUrl: string | null; hasEbook: boolean; hasAudiobook: boolean; isPrint: boolean; coverImageUrl: string | null }[];
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
    const isPaid = order.status === "PAID";
    return {
      id: order.id,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      shippingAmount: order.shippingAmount != null ? Number(order.shippingAmount) : 0,
      fulfillmentAmount: order.fulfillmentAmount != null ? Number(order.fulfillmentAmount) : 0,
      processingFeeAmount: order.processingFeeAmount != null ? Number(order.processingFeeAmount) : 0,
      personalMessageFee: await orderMessageFee(order.id),
      personalMessages: await messagesForOrder(order.id),
      printJobStatus: order.printJobStatus,
      printJobError: order.printJobError,
      items: order.lines.map((l) => {
        const isEbook = l.format === "ebook";
        const isAudiobook = l.format === "audiobook";
        const isPrint = l.format === "paperback" || l.format === "hardcover";
        return {
          title: l.book.title,
          price: Number(l.grossAmount),
          // eBook: the manuscript (as before). Audiobook: its own AUDIOBOOK
          // file, via the purchase-checked download route — the audio file
          // is never served from a public URL.
          downloadUrl: !isPaid ? null : isEbook
            ? (l.book.files.find((f) => f.kind === "MANUSCRIPT")?.url ?? null)
            : isAudiobook
            ? (l.book.files.some((f) => f.kind === "AUDIOBOOK") ? `/api/downloads/${l.bookId}?format=audiobook` : null)
            : null,
          hasEbook: isEbook,
          hasAudiobook: isAudiobook,
          isPrint,
          coverImageUrl: l.book.coverImageUrl,
        };
      }),
    };
  } catch {
    return null;
  }
}
