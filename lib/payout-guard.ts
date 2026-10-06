import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The ONE place a PayoutRequest is ever created (actions/payouts.ts
 * queueDuePayouts and actions/admin.ts payScheduledBalance both go
 * through it), so "never a second PayoutRequest for the same user, same
 * earnings type, same payout period" is enforced in a single spot.
 *
 * The period is the calendar month the request is created in — the same
 * monthly cycle queueDuePayouts has always used (earnings release on the
 * 1st, payment is due by the 15th, one payout per wallet per cycle).
 *
 * The prisma schema has no unique constraint for this (and this change
 * deliberately does not touch it), so the check and the insert run
 * inside ONE Serializable transaction: if two requests race (a double
 * click, two tabs, two admins), Postgres lets only one of them commit
 * and the other fails with P2034, which is reported back as "conflict"
 * instead of creating a second row. A real unique index would be the
 * belt-and-braces fix; see the report for the recommendation.
 */

export type CreatePayoutOutcome =
  | { created: true; id: string }
  | { created: false; reason: "exists" | "conflict" };

export async function createPayoutOnce(args: {
  userId: string;
  recipientId: string;
  amount: number;
  earningsType: "AUTHOR" | "AFFILIATE";
  /** Defaults to REQUESTED (the schema default). */
  status?: "REQUESTED" | "PAID";
  resolvedAt?: Date;
  /** When true a REJECTED request in the same period does not count as
   * "already has one" (a rejected payout is closed; the person is then
   * paid directly). queueDuePayouts keeps its historic stricter rule:
   * any request at all in the month blocks queuing another. */
  ignoreRejected?: boolean;
  now?: Date;
}): Promise<CreatePayoutOutcome> {
  const now = args.now ?? new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  try {
    return await prisma.$transaction(
      async (tx: Prisma.TransactionClient): Promise<CreatePayoutOutcome> => {
        const existing = await tx.payoutRequest.findFirst({
          where: {
            userId: args.userId,
            earningsType: args.earningsType,
            requestedAt: { gte: periodStart, lt: periodEnd },
            ...(args.ignoreRejected ? { status: { not: "REJECTED" } } : {}),
          },
          select: { id: true },
        });
        if (existing) return { created: false, reason: "exists" };

        const row = await tx.payoutRequest.create({
          data: {
            userId: args.userId,
            recipientId: args.recipientId,
            amount: args.amount,
            currency: "USD",
            earningsType: args.earningsType,
            ...(args.status ? { status: args.status } : {}),
            ...(args.resolvedAt ? { resolvedAt: args.resolvedAt } : {}),
          },
          select: { id: true },
        });
        return { created: true, id: row.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (e) {
    // P2034: a concurrent transaction won the race (serialization failure).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") return { created: false, reason: "conflict" };
    throw e;
  }
}
