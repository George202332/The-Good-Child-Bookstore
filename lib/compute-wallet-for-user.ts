import { prisma } from "@/lib/prisma";
import { computeWallet } from "@/lib/wallet";
import { fetchEarningsBreakdown, linesForView } from "@/lib/earnings-lines";

/**
 * Same wallet math as actions/wallet.ts getMyWallet() — both now share
 * the exact same earnings fetch (see lib/earnings-lines.ts) — but for
 * an arbitrary userId rather than the current signed-in session, used
 * by the monthly payout cron job
 * (app/api/cron/monthly-payouts/route.ts), which needs to compute
 * every user's wallet in a system context, not a per-request session
 * context.
 */
export async function computeWalletForUserId(userId: string, view: "author" | "affiliate"): Promise<{ available: number }> {
  try {
    const breakdown = await fetchEarningsBreakdown(userId);
    const lines = linesForView(breakdown, view);

    const payouts = await prisma.payoutRequest.findMany({ where: { userId } });
    const paidOut = payouts
      .filter((p: { status: string }) => p.status === "PAID")
      .reduce((sum: number, p: { amount: unknown }) => sum + Number(p.amount), 0);
    const pending = payouts
      .filter((p: { status: string }) => p.status === "REQUESTED" || p.status === "APPROVED")
      .reduce((sum: number, p: { amount: unknown }) => sum + Number(p.amount), 0);

    return { available: computeWallet(lines, paidOut, pending).available };
  } catch {
    return { available: 0 };
  }
}
