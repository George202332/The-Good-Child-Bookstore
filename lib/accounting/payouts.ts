/**
 * Payout figures for the Accounting page. Pure code (no database) so the rules can be tested.
 *
 * Payouts are money owed to authors and affiliates. They do NOT reduce company revenue; they are shown next to the
 * reconciliation so you can see what was paid out and what is still owed.
 */
import { cents } from "@/lib/accounting/calc";

export type PayoutKind = "AUTHOR" | "AFFILIATE";

/** One earning (an author's royalty, an affiliate's promotion commission or referral earning) from a PAID sale line. */
export interface EarningRow {
  userId: string;
  userName: string;
  accountNumber: string;
  kind: PayoutKind;
  /** What this earning is: royalty, promotion or referral. */
  type: "ROYALTY" | "PROMOTION" | "REFERRAL";
  createdAt: Date;
  amount: number;
  orderRef: string;
  bookTitle: string;
}

export interface PayoutRow {
  id: string;
  /** Short reference people can quote: the payout request id. There is no separate bank reference stored. */
  reference: string;
  userId: string;
  recipientName: string;
  accountNumber: string;
  kind: PayoutKind;
  amount: number;
  status: string;
  method: string;
  requestedAt: Date;
  resolvedAt: Date | null;
  /** The earnings month this payout covers, "YYYY-MM": the month before it was queued. */
  coversMonth: string;
}

export interface OwedRow {
  userId: string;
  name: string;
  accountNumber: string;
  kind: PayoutKind;
  earned: number;
  paid: number;
  /** Queued or approved but not yet paid. */
  queued: number;
  /** Earned in a month that has not ended / not yet released (releases on the 1st of the next month). */
  onHold: number;
  /** Released and not yet paid or queued. */
  available: number;
  /** earned - paid. */
  owed: number;
  /** True when what is available is below the minimum payout, so it rolls to the next month. */
  belowMinimum: boolean;
}

function releaseDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

/**
 * What each person is still owed at the instant `asOf`: earned up to then, minus payouts already paid by then.
 * "Held back" is the part not yet released (an earning releases on the 1st of the month after it was earned); "available"
 * is released money not yet paid or queued; "below minimum" means that available amount is under the minimum payout.
 */
export function computeOwed(earnings: EarningRow[], payouts: PayoutRow[], asOf: Date, minimum: number): OwedRow[] {
  const byPerson = new Map<string, OwedRow>();
  const key = (userId: string, kind: PayoutKind) => `${userId}|${kind}`;
  const rowFor = (userId: string, name: string, accountNumber: string, kind: PayoutKind): OwedRow => {
    const k = key(userId, kind);
    let r = byPerson.get(k);
    if (!r) {
      r = { userId, name, accountNumber, kind, earned: 0, paid: 0, queued: 0, onHold: 0, available: 0, owed: 0, belowMinimum: false };
      byPerson.set(k, r);
    }
    return r;
  };
  const releasedCents = new Map<string, number>();
  const earnedCents = new Map<string, number>();
  const heldCents = new Map<string, number>();
  const paidCents = new Map<string, number>();
  const queuedCents = new Map<string, number>();
  for (const e of earnings) {
    if (e.createdAt.getTime() >= asOf.getTime()) continue;
    const r = rowFor(e.userId, e.userName, e.accountNumber, e.kind);
    const k = key(r.userId, r.kind);
    earnedCents.set(k, (earnedCents.get(k) ?? 0) + cents(e.amount));
    if (releaseDate(e.createdAt).getTime() <= asOf.getTime()) releasedCents.set(k, (releasedCents.get(k) ?? 0) + cents(e.amount));
    else heldCents.set(k, (heldCents.get(k) ?? 0) + cents(e.amount));
  }
  for (const p of payouts) {
    if (p.requestedAt.getTime() >= asOf.getTime()) continue;
    const k = key(p.userId, p.kind);
    const settledBefore = p.resolvedAt !== null && p.resolvedAt.getTime() < asOf.getTime();
    if (settledBefore) {
      // Settled before that moment: a PAID one is money already paid out; a REJECTED one is nothing.
      if (p.status === "PAID") paidCents.set(k, (paidCents.get(k) ?? 0) + cents(p.amount));
    } else if (!(p.status === "REJECTED" && p.resolvedAt === null)) {
      // Not settled by that moment: it was queued and waiting.
      queuedCents.set(k, (queuedCents.get(k) ?? 0) + cents(p.amount));
    }
    if (!byPerson.has(k)) rowFor(p.userId, p.recipientName, p.accountNumber, p.kind);
  }
  const min = cents(minimum);
  const out: OwedRow[] = [];
  for (const [k, r] of byPerson) {
    const earned = earnedCents.get(k) ?? 0;
    const paid = paidCents.get(k) ?? 0;
    const queued = queuedCents.get(k) ?? 0;
    const held = heldCents.get(k) ?? 0;
    const released = releasedCents.get(k) ?? 0;
    const available = Math.max(0, released - paid - queued);
    out.push({
      ...r,
      earned: earned / 100,
      paid: paid / 100,
      queued: queued / 100,
      onHold: held / 100,
      available: available / 100,
      owed: (earned - paid) / 100,
      belowMinimum: available > 0 && available < min,
    });
  }
  return out.filter((r) => r.owed > 0.004 || r.queued > 0).sort((a, b) => b.owed - a.owed);
}

export interface OwedTotals {
  owed: number;
  queued: number;
  onHold: number;
  available: number;
  belowMinimum: number;
  people: number;
}

export function totalOwed(rows: OwedRow[]): OwedTotals {
  const t = { owed: 0, queued: 0, onHold: 0, available: 0, belowMinimum: 0, people: rows.length };
  for (const r of rows) {
    t.owed += cents(r.owed);
    t.queued += cents(r.queued);
    t.onHold += cents(r.onHold);
    t.available += cents(r.available);
    if (r.belowMinimum) t.belowMinimum += cents(r.available);
  }
  return { owed: t.owed / 100, queued: t.queued / 100, onHold: t.onHold / 100, available: t.available / 100, belowMinimum: t.belowMinimum / 100, people: t.people };
}
