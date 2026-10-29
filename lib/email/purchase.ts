import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { hasFileDownload, isPrintFormat } from "@/lib/delivery-format";
import { reportSystemError } from "@/lib/site-health/alert";
import { createOrderLoginToken } from "@/lib/order-login";
import { ORDER_LOGIN_MINUTES } from "@/lib/order-access";

/**
 * The one purchase email, for every kind of buyer and every format.
 *
 *  Case A  new guest (the checkout made them an account that has no password
 *          yet)        -> purchase details + a one-time "set your password" link
 *  Case B  guest whose email already had an account -> purchase details, "log in
 *          with your existing details", with a forgot-password link
 *  Case C  logged-in buyer of any role (reader, author, affiliate ...) -> the
 *          same email, sent to the account's own address
 *
 * Safety rules (all enforced below):
 *  - only ever sent for an order that is already PAID (confirmed by Paystack);
 *  - sent at most once per order: the order row is "claimed" with an atomic
 *    update before anything is sent, so concurrent webhook retries, the return
 *    page and demo-mode confirmation can never produce two emails;
 *  - no password of any kind is emailed. A first-time guest gets a link that
 *    works once and expires after GUEST_LINK_HOURS;
 *  - no book file is attached: eBook/audiobook lines link to the signed-in
 *    Library; paperback/hardcover lines are a shipping confirmation only.
 */

export const GUEST_LINK_HOURS = 24;

export interface PurchaseEmailLine {
  bookId: string;
  title: string;
  format: string | null;
  price: number;
  /** eBook/audiobook only: whether a file exists for the format bought. */
  fileReady: boolean;
}

export interface PurchaseEmailInput {
  siteUrl: string;
  orderNumber: string;
  orderDate: Date;
  buyerName: string;
  buyerEmail: string;
  lines: PurchaseEmailLine[];
  shippingAmount: number;
  totalAmount: number;
  shipTo?: { name?: string | null; address?: string | null; country?: string | null } | null;
  /** Present only for a brand-new guest account (Case A). */
  setPasswordUrl?: string;
  /** Present only for a brand-new guest account (Case A): one-time sign-in link, backup to the success-page button. */
  signInUrl?: string;
}

const FORMAT_LABEL: Record<string, string> = { ebook: "eBook", audiobook: "Audiobook", paperback: "Paperback", hardcover: "Hardcover" };

export function formatLabel(format: string | null | undefined): string {
  return FORMAT_LABEL[format ?? "ebook"] ?? "eBook";
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const money = (n: number) => `$${n.toFixed(2)}`;
const BUTTON = "display:inline-block;padding:12px 24px;background:#FF8C6B;color:#2E2440;text-decoration:none;border-radius:8px;font-weight:bold;";

/** Builds the subject and HTML body (inside the shared branded wrapper that sendEmail adds). */
export function buildPurchaseEmail(input: PurchaseEmailInput): { subject: string; html: string } {
  const { siteUrl } = input;
  const libraryUrl = `${siteUrl}/account/library`;
  const loginUrl = `${siteUrl}/login`;
  const forgotUrl = `${siteUrl}/forgot-password`;
  const firstName = escapeHtml((input.buyerName || "").trim().split(/\s+/)[0] || "there");
  const dateText = input.orderDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const rows = input.lines
    .map(
      (l) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid rgba(63,51,80,0.12);">${escapeHtml(l.title)}</td>
        <td style="padding:8px 8px;border-bottom:1px solid rgba(63,51,80,0.12);color:#6b6178;">${formatLabel(l.format)}</td>
        <td style="padding:8px 0;border-bottom:1px solid rgba(63,51,80,0.12);text-align:right;white-space:nowrap;">${money(l.price)}</td>
      </tr>`,
    )
    .join("");

  const digital = input.lines.filter((l) => hasFileDownload(l.format));
  const print = input.lines.filter((l) => isPrintFormat(l.format));

  const digitalHtml = digital.length
    ? `<h3 style="margin:22px 0 6px;font-size:16px;">Your digital books</h3>
       <p style="margin:0 0 8px;">Open them any time from your Library (you will be asked to sign in first):</p>
       <ul style="margin:0 0 10px;padding-left:20px;">
         ${digital
           .map(
             (l) =>
               `<li style="margin:4px 0;"><a href="${libraryUrl}" style="color:#6E4A00;">${escapeHtml(l.title)}</a> <span style="color:#6b6178;">(${formatLabel(l.format)}${l.fileReady ? "" : " &mdash; file being prepared"})</span></li>`,
           )
           .join("")}
       </ul>
       <p style="margin:0 0 6px;"><a href="${libraryUrl}" style="${BUTTON}">Open my Library</a></p>`
    : "";

  const shipLines = [input.shipTo?.name, input.shipTo?.address, input.shipTo?.country].filter((x): x is string => !!x && x.trim().length > 0);
  const printHtml = print.length
    ? `<h3 style="margin:22px 0 6px;font-size:16px;">Your printed books</h3>
       <p style="margin:0 0 6px;">${print.map((l) => `<strong>${escapeHtml(l.title)}</strong> (${formatLabel(l.format)})`).join(", ")} will be printed and shipped to you. There is no download for printed copies.</p>
       ${shipLines.length ? `<p style="margin:0 0 6px;color:#6b6178;font-size:13px;">Shipping to: ${shipLines.map(escapeHtml).join(", ")}</p>` : ""}`
    : "";

  const accountHtml = input.setPasswordUrl
    ? `<div style="background:#FBE6B8;border-radius:10px;padding:16px;margin:20px 0;">
         <p style="margin:0 0 6px;font-weight:bold;">We&rsquo;ve created your account</p>
         <p style="margin:0 0 10px;">Your login email is <strong>${escapeHtml(input.buyerEmail)}</strong>.${
           input.signInUrl
             ? ` Use the first button to step straight in (it works once and expires within ${ORDER_LOGIN_MINUTES} minutes), then choose your own password. If it has expired, the second button lets you set a password instead (valid ${GUEST_LINK_HOURS} hours).`
             : ` Choose your own password with the button below. The link works once and expires in ${GUEST_LINK_HOURS} hours.`
         }</p>
         ${input.signInUrl ? `<p style="margin:0 0 10px;"><a href="${input.signInUrl}" style="${BUTTON}">Go to my account</a></p>` : ""}
         <p style="margin:0 0 8px;"><a href="${input.setPasswordUrl}" style="${BUTTON}">Set my password</a></p>
         <p style="margin:0;font-size:12.5px;color:#6E4A00;">If the links have expired, use <a href="${forgotUrl}" style="color:#6E4A00;">Forgot password</a> and we will send a fresh one.</p>
       </div>`
    : `<p style="margin:20px 0 0;">Log in with your existing account details at <a href="${loginUrl}" style="color:#6E4A00;">${siteUrl.replace(/^https?:\/\//, "")}/login</a>. Forgotten your password? <a href="${forgotUrl}" style="color:#6E4A00;">Reset it here</a>.</p>`;

  const html = `
    <h2 style="margin:0 0 6px;font-size:22px;">Thank you, ${firstName}!</h2>
    <p style="margin:0 0 14px;">Your payment went through and your order is confirmed. Here is everything in one place.</p>
    <p style="margin:0 0 4px;color:#6b6178;font-size:13px;">Order <strong style="color:#2E2440;">#${input.orderNumber}</strong> &middot; ${dateText}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:10px 0 6px;font-size:14px;">${rows}</table>
    ${input.shippingAmount > 0 ? `<p style="margin:4px 0;text-align:right;font-size:14px;">Shipping: ${money(input.shippingAmount)}</p>` : ""}
    <p style="margin:4px 0 0;text-align:right;font-weight:bold;font-size:15px;">Total paid: ${money(input.totalAmount)}</p>
    ${digitalHtml}
    ${printHtml}
    ${accountHtml}
    <p style="margin:22px 0 0;">Happy reading,<br/>The Good Child Bookstore</p>`;

  const subject = input.setPasswordUrl
    ? `Thank you for your order #${input.orderNumber} - your account is ready`
    : `Your order #${input.orderNumber} is confirmed`;
  return { subject, html };
}

/** Issues the one-time link. Any older unused link for the same account is
 * withdrawn first, so only the newest one works. */
async function issueSetPasswordUrl(userId: string, siteUrl: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
  await prisma.passwordResetToken.create({
    data: { userId, token, expiresAt: new Date(Date.now() + GUEST_LINK_HOURS * 60 * 60 * 1000) },
  });
  return `${siteUrl}/reset-password?token=${token}`;
}

/** An order older than this is never emailed by a retry, so deploying this
 * change cannot re-send emails for orders paid long before it existed. */
const RETRY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export async function sendPurchaseEmail(orderId: string, opts?: { onlyIfRecent?: boolean }): Promise<{ sent: boolean; reason?: string }> {
  let claimed = false;
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        reader: { include: { user: true } },
        lines: { include: { book: { include: { files: true } } } },
      },
    });
    if (!order) return { sent: false, reason: "no such order" };
    // Never for a pending, failed or abandoned payment.
    if (order.status !== "PAID") return { sent: false, reason: "not paid" };
    if (order.purchaseEmailSentAt) return { sent: false, reason: "already sent" };
    if (opts?.onlyIfRecent && Date.now() - order.createdAt.getTime() > RETRY_WINDOW_MS) return { sent: false, reason: "too old to retry" };

    // Atomic claim: only one caller can move this from null to a timestamp.
    const claim = await prisma.order.updateMany({ where: { id: orderId, status: "PAID", purchaseEmailSentAt: null }, data: { purchaseEmailSentAt: new Date() } });
    if (claim.count === 0) return { sent: false, reason: "already sent" };
    claimed = true;

    const user = order.reader.user;
    const siteUrl = getPublicSiteUrl();
    const setPasswordUrl = user.guestSetupPending ? await issueSetPasswordUrl(user.id, siteUrl) : undefined;
    const signInUrl = user.guestSetupPending ? `${siteUrl}/welcome?token=${await createOrderLoginToken(user.id, orderId)}` : undefined;

    const { subject, html } = buildPurchaseEmail({
      siteUrl,
      orderNumber: orderId.slice(0, 8).toUpperCase(),
      orderDate: order.createdAt,
      buyerName: user.name,
      buyerEmail: user.email,
      lines: order.lines.map((l) => ({
        bookId: l.bookId,
        title: l.book.title,
        format: l.format,
        price: Number(l.grossAmount),
        fileReady: l.format === "audiobook" ? l.book.files.some((f) => f.kind === "AUDIOBOOK") : true,
      })),
      shippingAmount: Number(order.shippingAmount ?? 0),
      totalAmount: Number(order.totalAmount),
      shipTo: { name: order.shipName, address: order.shipAddress, country: order.shipCountry },
      setPasswordUrl,
      signInUrl,
    });

    // The PDF receipt is a nice extra: if it cannot be made, the email still goes.
    let attachment: { filename: string; content: Uint8Array } | undefined;
    try {
      const { generateOrderReceipt } = await import("@/lib/pdf/order-receipt");
      const bytes = await generateOrderReceipt({
        orderId: order.id,
        customerName: user.name,
        purchaseDate: order.createdAt,
        items: order.lines.map((l) => ({ title: l.book.title, format: l.format ?? "ebook", price: Number(l.grossAmount) })),
        totalAmount: Number(order.totalAmount),
        shippingAmount: Number(order.shippingAmount ?? 0),
      });
      attachment = { filename: `receipt-${orderId.slice(0, 8)}.pdf`, content: bytes };
    } catch (e) {
      console.error("[purchase email] receipt PDF could not be made; sending without it:", e instanceof Error ? e.message : e);
    }

    const result = await sendEmail(user.email, subject, html, attachment);
    if (!result.ok) {
      await prisma.order.updateMany({ where: { id: orderId }, data: { purchaseEmailSentAt: null } });
      claimed = false;
      await reportSystemError("EMAIL", new Error(result.error ?? "Purchase email could not be sent"), { orderId });
      return { sent: false, reason: result.error ?? "send failed" };
    }
    return { sent: true };
  } catch (e) {
    if (claimed) await prisma.order.updateMany({ where: { id: orderId }, data: { purchaseEmailSentAt: null } }).catch(() => undefined);
    await reportSystemError("EMAIL", e, { orderId });
    return { sent: false, reason: "error" };
  }
}
