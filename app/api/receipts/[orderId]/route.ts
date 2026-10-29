import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyOrderAccessToken } from "@/lib/order-access";

/**
 * Serves the PDF receipt for a PAID order and makes the browser save it straight
 * away (no new window, no sign-in page).
 *
 * Access: either the link carries this order's secret token (?t=...), which is
 * what lets a guest download without an account, or the visitor is signed in as
 * the order's buyer. Anyone else gets a plain "Not found" so order numbers can't
 * be probed. A receipt is proof of payment, so unpaid orders never get one.
 */
export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const token = new URL(request.url).searchParams.get("t");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { reader: { include: { user: true } }, lines: { include: { book: true } } },
  });
  if (!order) return new NextResponse("Not found.", { status: 404 });

  let allowed = verifyOrderAccessToken(orderId, token);
  if (!allowed) {
    const session = await auth();
    allowed = !!session?.user && order.reader.user.id === session.user.id;
  }
  if (!allowed) return new NextResponse("Not found.", { status: 404 });

  if (order.status !== "PAID") {
    return new NextResponse("This order has not been paid.", { status: 409 });
  }

  const { generateOrderReceipt } = await import("@/lib/pdf/order-receipt");
  const bytes = await generateOrderReceipt({
    orderId: order.id,
    customerName: order.reader.user.name,
    purchaseDate: order.createdAt,
    items: order.lines.map((l: { book: { title: string }; format: string | null; grossAmount: unknown }) => ({
      title: l.book.title,
      format: l.format ?? "ebook",
      price: Number(l.grossAmount),
    })),
    totalAmount: Number(order.totalAmount),
    shippingAmount: Number(order.shippingAmount ?? 0),
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${orderId.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
