"use server";

import { prisma } from "@/lib/prisma";
import { authAdmin } from "@/lib/auth-admin";
import type { Role } from "@/lib/roles";
import { payoutMethodLabel, formatAccountDetails } from "@/lib/payout-method-label";

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
  accountNumber: string;
  accountHolderName: string;
  email: string;
  role: string;
  paymentMethod: string;
  accountDetails: string;
  currency: string;
  bookSalesEarnings: number;
  affiliateEarnings: number;
  combinedTotal: number;
  status: string;
  paid: boolean;
  requestedAt: string;
  resolvedAt: string | null;
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

    return payouts.map((p) => {
      const amount = Number(p.amount);
      const isAffiliate = p.earningsType === "AFFILIATE";
      const recipient = recipientById.get(p.recipientId);
      return {
        id: p.id,
        accountNumber: p.user.accountNumber,
        accountHolderName: recipient?.accountHolderName ?? "Recipient deleted",
        email: p.user.email,
        role: p.user.role,
        paymentMethod: recipient ? payoutMethodLabel(recipient.type) : "—",
        accountDetails: recipient ? formatAccountDetails(recipient.details) : "—",
        currency: p.currency,
        bookSalesEarnings: isAffiliate ? 0 : amount,
        affiliateEarnings: isAffiliate ? amount : 0,
        combinedTotal: amount,
        status: p.status,
        paid: p.status === "PAID",
        requestedAt: p.requestedAt.toISOString(),
        resolvedAt: p.resolvedAt ? p.resolvedAt.toISOString() : null,
      };
    });
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
