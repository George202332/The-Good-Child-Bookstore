"use server";

import { prisma } from "@/lib/prisma";
import { authAdmin } from "@/lib/auth-admin";
import type { Role } from "@/lib/roles";
import { payoutMethodLabel, formatAccountDetails } from "@/lib/payout-method-label";
import { fetchEarningsBreakdown, linesForView, sumLines } from "@/lib/earnings-lines";
import { computeWallet, releaseDateFor } from "@/lib/wallet";

/**
 * The full admin payout ledger — every payout ever queued, whatever its
 * status, not just the ones still awaiting approval (see
 * app/admin/payouts/page.tsx, which previously only listed status
 * "REQUESTED" rows). Each row is one payout (see
 * actions/payouts.ts queueDuePayouts): since that action creates a
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

/** Shared by getLiveMonthRows and getPendingUnqueuedRows below — looks
 * up whichever payout destination is on file for this user, or a
 * "Not set yet" placeholder if none is, same either way regardless of
 * which synthetic row category is asking. */
async function recipientFieldsFor(userId: string) {
  const recipient = await prisma.wiseRecipient.findFirst({ where: { userId }, orderBy: { isDefault: "desc" } });
  return {
    accountHolderName: recipient ? recipient.accountHolderName : "Not set yet",
    paymentMethod: recipient ? payoutMethodLabel(recipient.type) : "—",
    accountDetails: recipient ? formatAccountDetails(recipient.details) : "—",
  };
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

/**
 * THE FIX for "a payout that should be in this ledger is missing."
 *
 * Root cause: before this function existed, the ledger only ever had
 * two sources — getLiveMonthRows (the CURRENT, still-open calendar
 * month's raw sales, recomputed fresh every load) and real
 * PayoutRequest rows (created only when an Admin clicks "Queue this
 * month's due payouts" AND that person already has a payout method on
 * file AND their balance clears the $30 minimum — see
 * lib/payout-threshold.ts, actions/payouts.ts queueDuePayouts).
 *
 * That leaves a real gap for any earnings month that is no longer the
 * current month, but was never actually queued into a PayoutRequest —
 * which happens whenever:
 *   - the balance was under $30 and intentionally rolled forward (the
 *     explicit, correct behavior per lib/payout-threshold.ts — NOT a
 *     bug on its own), or
 *   - the recipient had no payout method on file yet when the button
 *     was last clicked, so queueDuePayouts silently skipped them that
 *     run (`if (!recipient) continue`), or
 *   - the button simply wasn't clicked that month at all.
 *
 * None of that money is ever actually lost — computeWallet's
 * "available" (released, minus whatever's already paid/pending) still
 * adds it to whatever gets queued later. But until that later queueing
 * happens, it was invisible on THIS page: not the current month (so
 * getLiveMonthRows skips it), and not a real PayoutRequest (none
 * exists yet). The author/affiliate's OWN Monthly Payout History
 * (lib/payout-monthly.ts computeMonthlyPayoutRows) doesn't have this
 * gap — it buckets every month with real earnings and shows each one
 * as "Pending payout" whether or not a PayoutRequest covers it yet —
 * so the admin ledger was actually showing LESS than what the account
 * holder could already see for themselves, which is exactly how one
 * real, already-earned payout can go missing from this specific table.
 *
 * The fix: surface that same released-but-unqueued balance here too,
 * as one synthetic "Pending" row per author/affiliate (status
 * "UNQUEUED" — deliberately distinct from the real "REQUESTED" status
 * so ModerationActions' Approve/Reject never renders against a row
 * that has no real PayoutRequest id behind it). Referral and
 * commission are split proportionally to each category's own RELEASED
 * share (not lifetime share), so the two always add back up to exactly
 * the row's combinedTotal — same invariant item 1's totals-row fix
 * depends on. `reportMonthKey` points at the most recently closed
 * month as the best single-month approximation for the report
 * download link; a balance that rolled forward across several months
 * doesn't have one single "correct" month, which is an existing,
 * pre-existing limitation of the reportMonthKey concept (see
 * earningsMonthKeyFor above), not something this fix introduces.
 */
async function getPendingUnqueuedRows(): Promise<PayoutLedgerRow[]> {
  const now = new Date();
  const prevMonthKey = monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const rows: PayoutLedgerRow[] = [];

  function releasedSum(lines: { createdAt: Date; amount: number }[]): number {
    return lines.filter((l) => now.getTime() >= releaseDateFor(l.createdAt).getTime()).reduce((s, l) => s + l.amount, 0);
  }

  async function paidAndPendingFor(userId: string, earningsType: string): Promise<{ paidOut: number; pending: number }> {
    const payouts = (await prisma.payoutRequest.findMany({ where: { userId, earningsType } })) as { status: string; amount: unknown }[];
    const paidOut = payouts.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0);
    const pending = payouts.filter((p) => p.status === "REQUESTED" || p.status === "APPROVED").reduce((s, p) => s + Number(p.amount), 0);
    return { paidOut, pending };
  }

  const authors = await prisma.user.findMany({
    where: { role: "AUTHOR", authorProfile: { isNot: null } },
    select: { id: true, accountNumber: true, email: true, role: true },
  });
  for (const u of authors) {
    const breakdown = await fetchEarningsBreakdown(u.id);
    const lines = linesForView(breakdown, "author");
    const { paidOut, pending } = await paidAndPendingFor(u.id, "AUTHOR");
    const wallet = computeWallet(lines, paidOut, pending);
    if (wallet.available <= 0) continue;
    const fields = await recipientFieldsFor(u.id);
    rows.push({
      id: `pending-author-${u.id}`,
      userId: u.id,
      accountNumber: u.accountNumber,
      accountHolderName: fields.accountHolderName,
      email: u.email,
      role: u.role,
      paymentMethod: fields.paymentMethod,
      accountDetails: fields.accountDetails,
      currency: "USD",
      bookSalesEarnings: wallet.available,
      referralEarnings: 0,
      commissionEarnings: 0,
      combinedTotal: wallet.available,
      reportMonthKey: prevMonthKey,
      status: "UNQUEUED",
      paid: false,
      requestedAt: now.toISOString(),
      resolvedAt: null,
      isAffiliate: false,
    });
  }

  const affiliateProfiles = await prisma.affiliateProfile.findMany({
    select: { userId: true, user: { select: { accountNumber: true, email: true, role: true } } },
  });
  for (const a of affiliateProfiles as { userId: string; user: { accountNumber: string; email: string; role: string } }[]) {
    const breakdown = await fetchEarningsBreakdown(a.userId);
    const combinedLines = linesForView(breakdown, "affiliate");
    const { paidOut, pending } = await paidAndPendingFor(a.userId, "AFFILIATE");
    const wallet = computeWallet(combinedLines, paidOut, pending);
    if (wallet.available <= 0) continue;

    // Split the netted "available" figure between Referral and
    // Commission proportionally to each category's own RELEASED
    // total — not their lifetime total — so this stays accurate even
    // when one category is fully paid off already and the other isn't.
    const releasedReferral = releasedSum(breakdown.referral);
    const releasedCommission = releasedSum(breakdown.commission);
    const releasedCombined = releasedReferral + releasedCommission;
    const referralEarnings = releasedCombined > 0 ? +(wallet.available * (releasedReferral / releasedCombined)).toFixed(2) : 0;
    const commissionEarnings = +(wallet.available - referralEarnings).toFixed(2);

    const fields = await recipientFieldsFor(a.userId);
    rows.push({
      id: `pending-affiliate-${a.userId}`,
      userId: a.userId,
      accountNumber: a.user.accountNumber,
      accountHolderName: fields.accountHolderName,
      email: a.user.email,
      role: a.user.role,
      paymentMethod: fields.paymentMethod,
      accountDetails: fields.accountDetails,
      currency: "USD",
      bookSalesEarnings: 0,
      referralEarnings,
      commissionEarnings,
      combinedTotal: wallet.available,
      reportMonthKey: prevMonthKey,
      status: "UNQUEUED",
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
  // the guard now added in actions/payout-methods.ts, but a page that
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

    // Live rows (current, still-open month) lead the ledger, then any
    // released-but-not-yet-queued "Pending" balances (see
    // getPendingUnqueuedRows — this is what closes the "a real payout
    // is missing" gap), then every real payout ever queued, most
    // recent first — the same rolling live → pending → paid pattern as
    // the author-facing Payout Settings page, just across every
    // account instead of just one.
    const liveRows = await getLiveMonthRows();
    const pendingRows = await getPendingUnqueuedRows();
    return [...liveRows, ...pendingRows, ...historicalRows];
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
