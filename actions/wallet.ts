"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { computeWallet, nextReleaseDate, type Wallet } from "@/lib/wallet";
import { fetchEarningsBreakdown, linesForView } from "@/lib/earnings-lines";

/**
 * Real wallet balance (On Hold / Available) for the signed-in author or
 * affiliate — see lib/wallet.ts for the monthly release schedule.
 * Replaces the single "available balance" number the earlier payouts.ts
 * had; this is role-aware (authors earn authorShare on their own books,
 * affiliates earn affiliateShare on their own AffiliateLinks) but
 * shares the same hold/payout math either way.
 */

export interface WalletResult extends Wallet {
  saleCount: number;
  /** The earliest date any of this wallet's on-hold earnings become
   * available — null if nothing is currently on hold. */
  nextReleaseDate: string | null;
}

const EMPTY_WALLET: WalletResult = { totalEarned: 0, onHold: 0, available: 0, saleCount: 0, nextReleaseDate: null };

/**
 * Real wallet balance (On Hold / Available) for the signed-in user's
 * author or affiliate earnings — see lib/wallet.ts for the monthly
 * release schedule. `perspective` picks which one explicitly (a Reader
 * or Author with affiliate access enabled — see
 * actions/reader-affiliate.ts — has no AUTHOR role but still has real
 * affiliate earnings to show on the Earnings page), defaulting to
 * whichever matches the user's primary role if not given.
 */
export async function getMyWallet(perspective?: "author" | "affiliate"): Promise<WalletResult> {
  const session = await auth();
  if (!session?.user) return EMPTY_WALLET;
  const role = session.user.role;
  const view = perspective ?? (role === "AUTHOR" ? "author" : "affiliate");

  try {
    const breakdown = await fetchEarningsBreakdown(session.user.id);
    const lines = linesForView(breakdown, view);

    const payouts = await prisma.payoutRequest.findMany({ where: { userId: session.user.id } });
    const paidOut = payouts
      .filter((p: { status: string }) => p.status === "PAID")
      .reduce((sum: number, p: { amount: unknown }) => sum + Number(p.amount), 0);
    const pending = payouts
      .filter((p: { status: string }) => p.status === "REQUESTED" || p.status === "APPROVED")
      .reduce((sum: number, p: { amount: unknown }) => sum + Number(p.amount), 0);

    const wallet = computeWallet(lines, paidOut, pending);
    const releaseDate = nextReleaseDate(lines);
    return { ...wallet, saleCount: lines.length, nextReleaseDate: releaseDate ? releaseDate.toISOString() : null };
  } catch {
    return EMPTY_WALLET;
  }
}
