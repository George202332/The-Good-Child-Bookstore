/**
 * Wallet math shared by author Revenue and affiliate Earnings pages.
 *
 * Per explicit instruction: payouts are no longer requested on demand.
 * Instead, every sale's share is "On Hold" until the calendar month it
 * was earned in actually closes — at which point it becomes
 * "Available" on the 1st of the following month, e.g. everything
 * earned in June becomes available July 1st. An admin then has until
 * the 15th of that same month to actually send the money (see
 * actions/payouts.ts queueDuePayouts and actions/admin.ts
 * approvePayoutRequest) — the 15th is the LATEST allowable payout
 * date, a deadline, not the moment the money unlocks. (An earlier
 * round of this release logic used the 15th for both — unlocking and
 * the deadline landed on the same day, which is why money correctly
 * earned and released could still look "on hold"/invisible everywhere
 * in the system for the first two weeks of the month it was actually
 * payable in.)
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

/** The date a sale's earnings become available for payout processing:
 * the 1st of the month after the sale happened — e.g. a June sale
 * releases July 1st, giving an admin the rest of July (up to and
 * including the 15th, the actual payment deadline — see
 * app/account/payout-settings/page.tsx and app/admin/payouts/page.tsx
 * for where that deadline is surfaced) to actually send the money. */
export function releaseDateFor(saleDate: Date): Date {
  return new Date(saleDate.getFullYear(), saleDate.getMonth() + 1, 1);
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

/** The minimal shape of a PayoutRequest this file needs. */
export interface PayoutAmountLike {
  status: string;
  amount: unknown;
  /** "AUTHOR" or "AFFILIATE" — rows created before this field existed
   * default to "AUTHOR" in the database, so a missing value is treated
   * the same way here. */
  earningsType?: string;
}

/**
 * How much of ONE wallet (author royalties, or affiliate earnings) has
 * already been paid out, and how much is queued/in flight, for the
 * payout requests of a single user.
 *
 * Every wallet screen, queueDuePayouts, payScheduledBalance and the
 * admin ledger now share this one function. Before it existed, three of
 * those four netted EVERY payout of the user against EACH wallet
 * regardless of earningsType (so for an account that is both an author
 * and an affiliate, a payout from one wallet reduced the other wallet
 * too), while the admin ledger filtered by type — the two disagreed,
 * which is how the ledger could show a "Scheduled" balance that the pay
 * action then refused as "under $30". PROCESSING (a legacy in-flight
 * status, see the PayoutStatus enum) counts as pending, not as nothing:
 * leaving it out let the same money show up a second time as a
 * synthetic Scheduled row next to the real queued one.
 */
export function summarizePayouts(
  payouts: PayoutAmountLike[],
  earningsType: "AUTHOR" | "AFFILIATE"
): { paidOut: number; pending: number } {
  let paidOut = 0;
  let pending = 0;
  for (const p of payouts) {
    if ((p.earningsType ?? "AUTHOR") !== earningsType) continue;
    const amount = Number(p.amount);
    if (p.status === "PAID") paidOut += amount;
    else if (p.status === "REQUESTED" || p.status === "APPROVED" || p.status === "PROCESSING") pending += amount;
  }
  return { paidOut, pending };
}
