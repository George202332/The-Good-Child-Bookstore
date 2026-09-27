"use server";

import { prisma } from "@/lib/prisma";
import { authAdmin } from "@/lib/auth-admin";
import type { Role } from "@/lib/roles";
import { payoutMethodLabel, formatAccountDetails } from "@/lib/payout-method-label";
import { fetchEarningsBreakdown, sumLines } from "@/lib/earnings-lines";

/**
 * The full admin payout ledger — every payout ever queued, whatever its
 * status, not just the ones still awaiting approval (see
 * app/admin/payouts/page.tsx, which previously only listed status
 * "REQUESTED" rows). Each row is one Wise transfer (see
 * app/api/cron/monthly-payouts/route.ts): since that job creates a
 * separate PayoutRequest for book-sales earnings vs affiliate earnings
 * even for the same person in the same month, the split between the
 * two is naturally one-or-the-other on any given row today (see
 * earningsType on the PayoutRequest model) — the combinedTotal column
 * is already correct either way, and stays correct if a future change
 * ever combines both into a single transfer.
 */

function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The earnings month a payout covers is always the calendar month
 * BEFORE the one it was queued/paid in (payouts go out on the 15th of
 * the month following the earnings month — see lib/payout-monthly.ts). */
function earningsMonthKeyFor(requestedAt: Date): string {
  return monthKeyOf(new Date(requestedAt.getFullYear(), requestedAt.getMonth() - 1, 1));
}

/** Splits one user's affiliate earnings for a given calendar month into
 * "Referral" (a cut of company revenue from authors they referred onto
 * the platform) and "Commission" (their own affiliate-link promotion
 * earnings) — the same two real, separately-tracked figures the
 * author-facing Monthly Payout History table shows, just recomputed
 * here for a specific already-queued payout's month. Uses the same
 * shared fetch as everywhere else (see lib/earnings-lines.ts). */
async function referralAndCommissionFor(userId: string, monthKey: string): Promise<{ referral: number; commission: number }> {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr), month = Number(monthStr) - 1;
  if (Number.isNaN(year) || Number.isNaN(month)) return { referral: 0, commission: 0 };
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);

  const { referral, commission } = await fetchEarningsBreakdown(userId, { start, end });
  return { referral: sumLines(referral), commission: sumLines(commission) };
}

async function requireAdminOrAccountant() {
  const session = await authAdmin();
  const role = session?.user?.role as Role | undefined;
  if (!session?.user || (role !== "ADMIN" && role !== "ACCOUNTANT")) {
    throw new Error("Only Admin or Accountant can view the payout ledger.");
  }
  return role!;
}

export interface PayoutLedgerRow {
  id: string;
  /** The user this payout belongs to — needed so an Admin/Accountant can
   * download that SPECIFIC author's/affiliate's own payout report from
   * this ledger (see reportMonthKey below and app/api/payout-report). */
  userId: string;
  accountNumber: string;
  accountHolderName: string;
  email: string;
  role: string;
  paymentMethod: string;
  accountDetails: string;
  currency: string;
  bookSalesEarnings: number;
  /** A percentage of company revenue from authors this person referred
   * onto the platform. */
  referralEarnings: number;
  /** Commission from copies sold through this person's own affiliate
   * promotional links. */
  commissionEarnings: number;
  combinedTotal: number;
  /** The earnings month (YYYY-MM) this row's report download should
   * pull — the calendar month the money was actually earned in, not the
   * date the payout itself was queued (which is the 15th of the
   * FOLLOWING month) — matches the same monthKey used by the author's
   * own Monthly Payout History download link. */
  reportMonthKey: string;
  // "LIVE" is a synthetic status this file adds on top of the real
  // PayoutStatus enum (REQUESTED/APPROVED/PROCESSING/PAID/REJECTED) — it
  // represents the current, still-open month's accruing total for a
  // user, before the monthly cron has ever turned it into a real
  // PayoutRequest. See getLiveMonthRows below.
  status: string;
  paid: boolean;
  requestedAt: string;
  resolvedAt: string | null;
  /** True when this row is an affiliate-commission payout rather than a
   * book-sales payout — powers the admin ledger's "affiliate status"
   * filter. */
  isAffiliate: boolean;
}

/**
 * One synthetic "Live" row per author/affiliate with a nonzero current-
 * month accrual — the admin-side mirror of the rolling live → pending →
 * paid pattern on the author's own Payout Settings page (see
 * lib/payout-monthly.ts). These aren't real PayoutRequest rows (nothing
 * is written to the database for them): they're computed fresh from
 * real sale data on every load, so as soon as the calendar rolls over,
 * this same row disappears and is replaced by the real "Pending"
 * PayoutRequest the cron creates for the now-closed month — a rolling
 * pattern with no stored per-row state to keep in sync. Users with zero
 * activity so far this month are left out, so the ledger isn't flooded
 * with $0.00 rows for every account that's never sold anything.
 *
 * This queries every author/affiliate in bulk in two groupBy-style
 * passes rather than calling fetchEarningsBreakdown() per user (see
 * lib/earnings-lines.ts) — that helper is scoped to one user at a
 * time, and looping it here would turn one bulk query into one query
 * per account. The categorization logic (organic/referral/commission)
 * is intentionally kept identical to fetchEarningsBreakdown's, just
 * inlined for this bulk shape.
 */
async function getLiveMonthRows(): Promise<PayoutLedgerRow[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const rows: PayoutLedgerRow[] = [];

  async function recipientFieldsFor(userId: string) {
    const recipient = await prisma.wiseRecipient.findFirst({ where: { userId }, orderBy: { isDefault: "desc" } });
    return {
      accountHolderName: recipient ? recipient.accountHolderName : "Not set yet",
      paymentMethod: recipient ? payoutMethodLabel(recipient.type) : "—",
      accountDetails: recipient ? formatAccountDetails(recipient.details) : "—",
    };
  }

  const authors = (await prisma.user.findMany({
    where: { role: "AUTHOR", authorProfile: { isNot: null } },
    include: {
      authorProfile: {
        include: { books: { include: { saleLines: { where: { createdAt: { gte: start, lt: end } } } } } },
      },
    },
  })) as {
    id: string; accountNumber: string; email: string; role: string;
    authorProfile: { books: { saleLines: { authorShare: unknown }[] }[] } | null;
  }[];
  for (const u of authors) {
    const books = u.authorProfile?.books ?? [];
    const amount = books.reduce((sum, b) => sum + b.saleLines.reduce((s, l) => s + Number(l.authorShare), 0), 0);
    if (amount <= 0) continue;
    const fields = await recipientFieldsFor(u.id);
    rows.push({
      id: `live-author-${u.id}`,
      userId: u.id,
      accountNumber: u.accountNumber,
      accountHolderName: fields.accountHolderName,
      email: u.email,
      role: u.role,
      paymentMethod: fields.paymentMethod,
      accountDetails: fields.accountDetails,
      currency: "USD",
      bookSalesEarnings: amount,
      referralEarnings: 0,
      commissionEarnings: 0,
      combinedTotal: amount,
      reportMonthKey: monthKeyOf(now),
      status: "LIVE",
      paid: false,
      requestedAt: now.toISOString(),
      resolvedAt: null,
      isAffiliate: false,
    });
  }

  const affiliateProfiles = (await prisma.affiliateProfile.findMany({
    include: {
      user: true,
      affiliateLinks: { include: { saleLines: { where: { createdAt: { gte: start, lt: end } } } } },
      authorReferralEarnings: { where: { createdAt: { gte: start, lt: end } } },
    },
  })) as {
    userId: string;
    user: { accountNumber: string; email: string; role: string };
    affiliateLinks: { saleLines: { affiliateShare: unknown }[] }[];
    authorReferralEarnings: { authorReferralShare: unknown }[];
  }[];
  for (const a of affiliateProfiles) {
    const direct = a.affiliateLinks.reduce((sum, l) => sum + l.saleLines.reduce((s, sl) => s + Number(sl.affiliateShare), 0), 0);
    const referral = a.authorReferralEarnings.reduce((sum, r) => sum + Number(r.authorReferralShare), 0);
    const amount = direct + referral;
    if (amount <= 0) continue;
    const fields = await recipientFieldsFor(a.userId);
    rows.push({
      id: `live-affiliate-${a.userId}`,
      userId: a.userId,
      accountNumber: a.user.accountNumber,
      accountHolderName: fields.accountHolderName,
      email: a.user.email,
      role: a.user.role,
      paymentMethod: fields.paymentMethod,
      accountDetails: fields.accountDetails,
      currency: "USD",
      bookSalesEarnings: 0,
      referralEarnings: referral,
      commissionEarnings: direct,
      combinedTotal: amount,
      reportMonthKey: monthKeyOf(now),
      status: "LIVE",
      paid: false,
      requestedAt: now.toISOString(),
      resolvedAt: null,
      isAffiliate: true,
    });
  }

  return rows;
}

export async function getPayoutLedger(): Promise<PayoutLedgerRow[] | { error: string }> {
  try {
    await requireAdminOrAccountant();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not authorized." };
  }

  // Recipient is fetched as a SEPARATE query rather than via `include`
  // deliberately: `include` on a required relation makes Prisma throw
  // ("Inconsistent query result... Field recipient is required") the
  // instant it hits even one PayoutRequest whose WiseRecipient row is
  // gone — which is exactly what crashed this page. That could only
  // happen if a recipient with real payout history got deleted despite
  // the guard now added in actions/wise-recipients.ts, but a page that
  // reads a payout's entire history (unlike the old REQUESTED-only
  // view) has to stay readable even if an old, already-orphaned row
  // like that exists from before that guard existed — so any payout
  // whose recipient can no longer be found renders "Recipient deleted"
  // instead of taking the whole ledger down with it.
  try {
    const payouts = (await prisma.payoutRequest.findMany({
      include: { user: true },
      orderBy: { requestedAt: "desc" },
    })) as {
      id: string;
      userId: string;
      amount: unknown;
      currency: string;
      status: string;
      earningsType: string;
      requestedAt: Date;
      resolvedAt: Date | null;
      recipientId: string;
      user: { accountNumber: string; email: string; role: string };
    }[];

    const recipientIds = [...new Set(payouts.map((p) => p.recipientId))];
    const recipients = (await prisma.wiseRecipient.findMany({
      where: { id: { in: recipientIds } },
    })) as { id: string; accountHolderName: string; type: string; details: unknown }[];
    const recipientById = new Map(recipients.map((r) => [r.id, r]));

    const historicalRows: PayoutLedgerRow[] = await Promise.all(
      payouts.map(async (p) => {
        const amount = Number(p.amount);
        const isAffiliate = p.earningsType === "AFFILIATE";
        const recipient = recipientById.get(p.recipientId);
        const reportMonthKey = earningsMonthKeyFor(p.requestedAt);
        const split = isAffiliate ? await referralAndCommissionFor(p.userId, reportMonthKey) : { referral: 0, commission: 0 };
        return {
          id: p.id,
          userId: p.userId,
          accountNumber: p.user.accountNumber,
          accountHolderName: recipient?.accountHolderName ?? "Recipient deleted",
          email: p.user.email,
          role: p.user.role,
          paymentMethod: recipient ? payoutMethodLabel(recipient.type) : "—",
          accountDetails: recipient ? formatAccountDetails(recipient.details) : "—",
          currency: p.currency,
          bookSalesEarnings: isAffiliate ? 0 : amount,
          referralEarnings: split.referral,
          commissionEarnings: split.commission,
          combinedTotal: amount,
          reportMonthKey,
          status: p.status,
          paid: p.status === "PAID",
          requestedAt: p.requestedAt.toISOString(),
          resolvedAt: p.resolvedAt ? p.resolvedAt.toISOString() : null,
          isAffiliate,
        };
      })
    );

    // Live rows (current, still-open month) lead the ledger, followed by
    // every real payout ever queued, most recent first — the same
    // rolling live → pending → paid pattern as the author-facing Payout
    // Settings page, just across every account instead of just one.
    const liveRows = await getLiveMonthRows();
    return [...liveRows, ...historicalRows];
  } catch (e) {
    // Surfaced on the page as a readable message instead of a generic
    // Next.js crash screen — see app/admin/payouts/page.tsx. Most
    // likely cause if this ever fires: the database hasn't picked up
    // the `earningsType` column yet (see prisma/schema.prisma) — run
    // `npx prisma db push` against the same DATABASE_URL the live site
    // uses.
    return { error: e instanceof Error ? e.message : "Couldn't load the payout ledger." };
  }
}
