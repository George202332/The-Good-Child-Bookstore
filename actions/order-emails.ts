"use server";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Sends the order receipt + download-link email — the piece that was
 * missing entirely before ("Confirmation email would be sent here once
 * an email service is wired up"). Called from both the demo-mode path
 * (actions/orders.ts confirmOrderPaidDirectly) and the real gateway path
 * (lib/payments/finalize.ts finalizeOrderPayment), so every order gets
 * one regardless of which path confirmed it.
 */
export async function sendOrderReceiptEmail(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        reader: { include: { user: true } },
        lines: { include: { book: { include: { files: true } } } },
      },
    });
    if (!order) return;

    const siteUrl = getSiteUrl();
    const itemsHtml = order.lines
      .map((l: { book: { title: string; hasEbook: boolean; files: { kind: string; url: string }[] }; grossAmount: unknown }) => {
        const downloadUrl = l.book.files.find((f) => f.kind === "MANUSCRIPT")?.url;
        const downloadLine = downloadUrl
          ? `<p style="margin:4px 0"><a href="${siteUrl}${downloadUrl}">Download "${l.book.title}"</a></p>`
          : "";
        return `<tr><td style="padding:6px 0">${l.book.title}${downloadLine}</td><td style="padding:6px 0;text-align:right">$${Number(l.grossAmount).toFixed(2)}</td></tr>`;
      })
      .join("");

    const html = `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto;">
        <h2>Thank you for your order!</h2>
        <p>Order #${orderId.slice(0, 8).toUpperCase()}</p>
        <table style="width:100%; border-collapse: collapse;">${itemsHtml}</table>
        <hr />
        <p style="font-weight:bold">Total paid: $${Number(order.totalAmount).toFixed(2)}</p>
        <p>You can also access your library any time at <a href="${siteUrl}/account/library">${siteUrl}/account/library</a>.</p>
        <p style="color:#888; font-size:12px;">The Good Child Bookstore</p>
      </div>
    `;

    await sendEmail(order.reader.user.email, `Your order #${orderId.slice(0, 8).toUpperCase()} is confirmed`, html);
  } catch {
    // Email is a nice-to-have on top of a successful order — never let
    // a failure here affect the purchase itself.
  }
}
