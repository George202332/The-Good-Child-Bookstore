/**
 * Wallet math shared by author Revenue and affiliate Earnings pages.
 *
 * Per explicit instruction: since there are no returns once a product is
 * purchased, there's no real reason to hold earnings for a long window —
 * but a short hold still makes sense to cover payment-processor disputes/
 * chargebacks before money is released for payout. Every sale's share
 * sits "On Hold" for HOLD_DAYS days after the sale, then moves to
 * "Available". Requested-but-not-yet-paid payouts are also carved out of
 * Available, since that money is already earmarked.
 */

export const HOLD_DAYS = 10;

export interface WalletShareLine {
  createdAt: Date;
  amount: number;
}

export interface Wallet {
  totalEarned: number;
  onHold: number;
  available: number;
}

export function computeWallet(lines: WalletShareLine[], paidOut: number, pendingPayouts: number): Wallet {
  const holdCutoff = Date.now() - HOLD_DAYS * 24 * 60 * 60 * 1000;
  let onHold = 0;
  let released = 0;

  for (const line of lines) {
    if (line.createdAt.getTime() > holdCutoff) {
      onHold += line.amount;
    } else {
      released += line.amount;
    }
  }

  const totalEarned = onHold + released;
  const available = Math.max(0, released - paidOut - pendingPayouts);

  return { totalEarned, onHold, available };
}
