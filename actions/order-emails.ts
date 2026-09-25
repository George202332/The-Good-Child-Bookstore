"use server";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getPublicSiteUrl as getSiteUrl } from "@/lib/seo/site-url";

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

    const accountHtml = order.guestTempPassword
      ? `
        <div style="background:#FBE6B8; border-radius:8px; padding:14px; margin:16px 0;">
          <p style="margin:0 0 8px; font-weight:bold;">Your account has been created</p>
          <p style="margin:0 0 4px;">Email: ${order.reader.user.email}</p>
          <p style="margin:0 0 4px;">Temporary password: <strong>${order.guestTempPassword}</strong></p>
          <p style="margin:8px 0 0;"><a href="${siteUrl}/login">Sign in to your account →</a></p>
          <p style="margin:8px 0 0; font-size:12px;">You'll be asked to set a real password the first time you sign in.</p>
        </div>
      `
      : "";

    const html = `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto;">
        <h2>Thank you for your order!</h2>
        <p>Order #${orderId.slice(0, 8).toUpperCase()}</p>
        <table style="width:100%; border-collapse: collapse;">${itemsHtml}</table>
        <hr />
        <p style="font-weight:bold">Total paid: $${Number(order.totalAmount).toFixed(2)}</p>
        ${accountHtml}
        <p>You can also access your library any time at <a href="${siteUrl}/account/library">${siteUrl}/account/library</a>.</p>
        <p style="color:#888; font-size:12px;">The Good Child Bookstore</p>
      </div>
    `;

    const { generateOrderReceipt } = await import("@/lib/pdf/order-receipt");
    const receiptBytes = await generateOrderReceipt({
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

    await sendEmail(
      order.reader.user.email,
      `Your order #${orderId.slice(0, 8).toUpperCase()} is confirmed`,
      html,
      { filename: `receipt-${orderId.slice(0, 8)}.pdf`, content: receiptBytes }
    );

    if (order.guestTempPassword) {
      await prisma.order.update({ where: { id: orderId }, data: { guestTempPassword: null } });
    }
  } catch {
    // Email is a nice-to-have on top of a successful order — never let
    // a failure here affect the purchase itself.
  }
}
