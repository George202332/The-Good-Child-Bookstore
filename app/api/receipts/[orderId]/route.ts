import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Serves the real digital receipt PDF for an order — checks the
 * signed-in user actually owns this order before generating it. */
export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const session = await auth();
  if (!session?.user) return new NextResponse("Sign in required.", { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { reader: { include: { user: true } }, lines: { include: { book: true } } },
  });
  if (!order || order.reader.user.id !== session.user.id) {
    return new NextResponse("Not found.", { status: 404 });
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
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${orderId.slice(0, 8)}.pdf"`,
    },
  });
}
