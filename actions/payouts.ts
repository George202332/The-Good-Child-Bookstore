"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getMyWallet } from "@/actions/wallet";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";

/**
 * Payout requests — now Wise-only (see docs/architecture.md and
 * lib/payments/wise.ts). A request targets one of the user's saved
 * WiseRecipients and is capped at their current Available balance (not
 * On Hold — see lib/wallet.ts). Admin approval actually moves money via
 * Wise (actions/admin.ts approvePayoutRequest).
 */

export interface PayoutRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  requestedAt: Date;
  recipientLabel: string;
}

export async function getMyPayoutRequests(): Promise<PayoutRow[]> {
  const session = await auth();
  if (!session?.user) return [];
  const role = session.user.role;
  if (role !== "AUTHOR" && role !== "AFFILIATE" && !(await hasAffiliateCapability(session.user.id))) return [];

  const payouts = await prisma.payoutRequest.findMany({
    where: { userId: session.user.id },
    include: { recipient: true },
    orderBy: { requestedAt: "desc" },
  });
  return payouts.map((p: { id: string; amount: unknown; currency: string; status: string; requestedAt: Date; recipient: { type: string; accountHolderName: string } }) => ({
    id: p.id,
    amount: Number(p.amount),
    currency: p.currency,
    status: p.status,
    requestedAt: p.requestedAt,
    recipientLabel: `${p.recipient.type} — ${p.recipient.accountHolderName}`,
  }));
}

export async function requestPayout(recipientId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };
  const role = session.user.role;
  if (role !== "AUTHOR" && role !== "AFFILIATE" && !(await hasAffiliateCapability(session.user.id))) {
    return { ok: false, error: "Not authorized." };
  }

  const recipient = await prisma.wiseRecipient.findUnique({ where: { id: recipientId } });
  if (!recipient || recipient.userId !== session.user.id) {
    return { ok: false, error: "Payout destination not found." };
  }

  const wallet = await getMyWallet();
  if (wallet.available <= 0) {
    return { ok: false, error: "No available balance to request. Recent sales are still on hold (10 days) before they're available for payout." };
  }

  await prisma.payoutRequest.create({
    data: {
      userId: session.user.id,
      recipientId,
      amount: wallet.available,
      currency: "USD",
    },
  });
  revalidatePath("/account/earnings");
  revalidatePath("/account/revenue");
  return { ok: true };
}
