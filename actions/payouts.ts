"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";

/**
 * Payout requests — now created automatically by the monthly cron job
 * (app/api/cron/monthly-payouts/route.ts) rather than requested by the
 * user. This just reads the resulting history. A request targets one
 * of the user's saved WiseRecipients; admin approval actually moves
 * money via Wise (actions/admin.ts approvePayoutRequest).
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
  if (role !== "AUTHOR" && !(await hasAffiliateCapability(session.user.id))) return [];

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
