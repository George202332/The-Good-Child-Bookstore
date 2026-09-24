"use server";

import { authAdmin } from "@/lib/auth-admin";
import { prisma } from "@/lib/prisma";
import { sendMarketingEmail } from "@/lib/email/marketing";

/** Count of readers currently opted in — shown on the compose page so
 * an admin knows the actual reach before sending, not just wondering. */
export async function getMarketingOptInCount(): Promise<number> {
  const session = await authAdmin();
  if (!session?.user || session.user.role !== "ADMIN") return 0;
  return prisma.user.count({ where: { marketingOptIn: true, role: "READER" } });
}

export async function sendMarketingBlast(subject: string, bodyHtml: string): Promise<{ ok: boolean; sent?: number; failed?: number; error?: string }> {
  const session = await authAdmin();
  if (!session?.user || session.user.role !== "ADMIN") return { ok: false, error: "Not authorized." };
  if (!subject.trim()) return { ok: false, error: "Subject is required." };
  if (!bodyHtml.trim()) return { ok: false, error: "Message body is required." };

  const result = await sendMarketingEmail(subject.trim(), bodyHtml);
  return { ok: true, sent: result.sent, failed: result.failed };
}
