/**
 * Wallet math shared by author Revenue and affiliate Earnings pages.
 *
 * Per explicit instruction: payouts are no longer requested on demand.
 * Instead, every sale's share is "On Hold" until money earned in a
 * given calendar month automatically becomes "Available" on the 15th
 * of the following month — e.g. everything earned in June becomes
 * payable on July 15th. Once available, it's paid out automatically
 * (see app/api/cron/monthly-payouts/route.ts) rather than requiring
 * the author/affiliate to click a "request payout" button.
 */

export interface WalletShareLine {
  createdAt: Date;
  amount: number;
}

export interface Wallet {
  totalEarned: number;
  onHold: number;
  available: number;
}

/** The date a sale's earnings become available: the 15th of the month
 * after the sale happened. */
export function releaseDateFor(saleDate: Date): Date {
  return new Date(saleDate.getFullYear(), saleDate.getMonth() + 1, 15);
}

function isReleased(saleDate: Date, now: Date): boolean {
  return now.getTime() >= releaseDateFor(saleDate).getTime();
}

export function computeWallet(lines: WalletShareLine[], paidOut: number, pendingPayouts: number): Wallet {
  const now = new Date();
  let onHold = 0;
  let released = 0;

  for (const line of lines) {
    if (isReleased(line.createdAt, now)) {
      released += line.amount;
    } else {
      onHold += line.amount;
    }
  }

  const totalEarned = onHold + released;
  const available = Math.max(0, released - paidOut - pendingPayouts);

  return { totalEarned, onHold, available };
}

/** The earliest upcoming release date among a set of still-on-hold
 * lines — e.g. if some earnings are from last month (releasing the
 * 15th of this month) and some are from this month (releasing next
 * month), this returns the sooner of the two. Returns null if nothing
 * is currently on hold. */
export function nextReleaseDate(lines: WalletShareLine[]): Date | null {
  const now = new Date();
  let earliest: Date | null = null;
  for (const line of lines) {
    if (isReleased(line.createdAt, now)) continue;
    const release = releaseDateFor(line.createdAt);
    if (!earliest || release < earliest) earliest = release;
  }
  return earliest;
}
