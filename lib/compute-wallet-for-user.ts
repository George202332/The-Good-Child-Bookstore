import { prisma } from "@/lib/prisma";
import { computeWallet, summarizePayouts } from "@/lib/wallet";
import { fetchEarningsBreakdown, linesForView } from "@/lib/earnings-lines";

/**
 * Same wallet math as actions/wallet.ts getMyWallet() — both now share
 * the exact same earnings fetch (see lib/earnings-lines.ts) — but for
 * an arbitrary userId rather than the current signed-in session, used
 * by the admin-triggered payout queueing action
 * (actions/payouts.ts queueDuePayouts), which needs to compute every
 * user's wallet in a system context, not a per-request session context.
 */
export async function computeWalletForUserId(userId: string, view: "author" | "affiliate"): Promise<{ available: number }> {
  try {
    const breakdown = await fetchEarningsBreakdown(userId);
    const lines = linesForView(breakdown, view);

    const payouts = await prisma.payoutRequest.findMany({ where: { userId } });
    // Only THIS wallet's own payouts are netted against it (see
    // summarizePayouts in lib/wallet.ts for why).
    const { paidOut, pending } = summarizePayouts(payouts, view === "author" ? "AUTHOR" : "AFFILIATE");

    return { available: computeWallet(lines, paidOut, pending).available };
  } catch {
    return { available: 0 };
  }
}
