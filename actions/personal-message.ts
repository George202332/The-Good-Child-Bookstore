"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";
import { verifyOrderAccessToken, confirmationUrl } from "@/lib/order-access";
import { checkMessage, cleanMessage, isStyleId, isValidFee, DEFAULT_STYLE_ID, PERSONAL_MESSAGE_FEE_MAX } from "@/lib/personal-message";
import { getPersonalMessageFee, savePersonalMessageFee } from "@/lib/personal-message-settings";
import { decideRecord, lineMessageStatus, replaceMessage } from "@/lib/personal-message-db";

type Result = { ok: boolean; error?: string };

/** The fee per personalised line, shown at checkout (public: it is a price, not a secret). */
export async function getPersonalMessageFeeAction(): Promise<number> {
  return getPersonalMessageFee();
}

/** Admin only: sets the Personal Message fee (zero by default). Applies to new orders only. */
export async function updatePersonalMessageFee(fee: number): Promise<Result> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can change the Personal Message fee." };
  if (!isValidFee(fee)) return { ok: false, error: `The fee must be between $0 and $${PERSONAL_MESSAGE_FEE_MAX}.` };
  await savePersonalMessageFee(fee);
  revalidatePath("/admin/personal-messages");
  return { ok: true };
}

/** Admin, Editor and Chief Editor: approve or reject a held message. Nothing is ever deleted; the decision is added to the record. */
export async function decidePersonalMessage(recordId: string, action: "approve" | "reject", note: string): Promise<Result> {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "ADMIN" && role !== "EDITOR" && role !== "CHIEF_EDITOR") return { ok: false, error: "You do not have permission to decide this." };
  const result = await decideRecord(recordId, action, { id: session!.user!.id as string, name: (session!.user!.name as string) ?? role }, note.trim().slice(0, 300));
  if (!result.ok) return result;
  try {
    if (action === "approve") {
      // The print job was waiting for this: send it on now (it checks everything again, and staging stays held).
      const { submitPrintJobsForOrder } = await import("@/lib/payments/lulu");
      await submitPrintJobsForOrder(result.orderId);
    } else {
      await tellBuyerRejected(result.orderId, note);
    }
  } catch (e) {
    console.error("[personal message] follow-up after the decision failed:", e instanceof Error ? e.message.slice(0, 200) : "unknown");
  }
  revalidatePath("/admin/personal-messages");
  revalidatePath("/admin");
  return { ok: true };
}

async function tellBuyerRejected(orderId: string, note: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { reader: { select: { user: { select: { email: true, name: true } } } } } });
  const to = order?.reader.user.email;
  if (!to) return;
  const { sendEmail } = await import("@/lib/email");
  const { escapeHtml } = await import("@/lib/email/purchase");
  const first = escapeHtml((order?.reader.user.name ?? "").split(/\s+/)[0] || "there");
  const html = `<p>Hello ${first},</p>
<p>We could not print the Personal Message you wrote for your order, so we have paused that book. Nothing else is wrong with your order and you do not need to pay again.</p>
${note.trim() ? `<p>Note from our team: ${escapeHtml(note.trim())}</p>` : ""}
<p><a href="${confirmationUrl(orderId)}">Open your order and write a new message</a>. As soon as it is accepted, your book goes to print.</p>`;
  await sendEmail(to, "Please write a new Personal Message for your order", html);
}

/** The buyer writes a new message after a rejection. Allowed only with the order's secret key or from the owner's signed-in account. */
export async function replaceMyPersonalMessage(orderId: string, key: string | null, saleLineId: string, text: string, style: string): Promise<Result> {
  const session = await auth();
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, printJobStatus: true, reader: { select: { userId: true } } } });
  if (!order || order.status !== "PAID") return { ok: false, error: "This order is not available." };
  const owner = !!session?.user && session.user.id === order.reader.userId;
  if (!owner && !verifyOrderAccessToken(orderId, key)) return { ok: false, error: "This link is not valid." };
  if (order.printJobStatus === "SUBMITTED") return { ok: false, error: "This order has already gone to print." };
  const line = await lineMessageStatus(orderId, saleLineId);
  if (!line || line.status !== "REJECTED") return { ok: false, error: "This message does not need to be changed." };
  const clean = cleanMessage(text);
  if (!clean) return { ok: false, error: "Please write a message." };
  const check = checkMessage(clean);
  await replaceMessage(orderId, saleLineId, line.bookId, clean, isStyleId(style) ? style : DEFAULT_STYLE_ID, check);
  if (!check.flagged) {
    const { submitPrintJobsForOrder } = await import("@/lib/payments/lulu");
    await submitPrintJobsForOrder(orderId);
  } else {
    revalidatePath("/admin/personal-messages");
  }
  return { ok: true };
}
