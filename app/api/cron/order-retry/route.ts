import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { purgeOldBuckets } from "@/lib/rate-limit";
import { reportSystemError } from "@/lib/site-health/alert";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

const MIN_AGE_MS = 15 * 60 * 1000;      // leave a fresh order alone: its own follow-up is still running
const PRINT_RETRY_WINDOW_MS = 12 * 3600 * 1000;
const RECEIPT_WINDOW_MS = 6 * 3600 * 1000;
const MAX_PER_RUN = 10;

/**
 * Safety net for work that runs after a payment (print job, receipt e-mail). Called every 30 minutes by GitHub Actions
 * (.github/workflows/order-retry.yml) with "Authorization: Bearer <CRON_SECRET>". Every step is safe to repeat:
 *  - a print job that already went to Lulu is skipped by submitPrintJobsForOrder, and test/staging orders stay held;
 *  - the receipt e-mail does nothing when it was already sent.
 * It also deletes day-old rate limit counters.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set on this deployment." }, { status: 503 });
  if (!same(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return NextResponse.json({ error: "Not allowed." }, { status: 401 });

  const now = Date.now();
  let printRetried = 0, receiptsChecked = 0;
  try {
    const printOrders = await prisma.order.findMany({
      where: {
        status: "PAID",
        createdAt: { lt: new Date(now - MIN_AGE_MS), gt: new Date(now - PRINT_RETRY_WINDOW_MS) },
        OR: [{ printJobStatus: null }, { printJobStatus: "FAILED" }],
        lines: { some: { format: { in: ["paperback", "hardcover"] } } },
      },
      select: { id: true },
      take: MAX_PER_RUN,
    });
    const { submitPrintJobsForOrder } = await import("@/lib/payments/lulu");
    for (const o of printOrders) { await submitPrintJobsForOrder(o.id); printRetried++; }

    const recent = await prisma.order.findMany({
      where: { status: "PAID", createdAt: { lt: new Date(now - MIN_AGE_MS), gt: new Date(now - RECEIPT_WINDOW_MS) } },
      select: { id: true },
      take: 25,
    });
    const { sendOrderReceiptEmail } = await import("@/actions/order-emails");
    for (const o of recent) { await sendOrderReceiptEmail(o.id, { onlyIfRecent: true }); receiptsChecked++; }
  } catch (e) {
    await reportSystemError("CHECKOUT", e, { stage: "order-retry" });
  }
  await purgeOldBuckets();
  return NextResponse.json({ printRetried, receiptsChecked });
}
