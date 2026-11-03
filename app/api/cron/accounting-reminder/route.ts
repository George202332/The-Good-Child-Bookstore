import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runMonthEndReminder } from "@/lib/accounting/close";

export const dynamic = "force-dynamic";

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The daily scheduled job (vercel.json). On the last day of the month (Nairobi time), if the month is still open, it sends
 * the admins one reminder notification. It never closes a month and never sends a report.
 * Vercel sends "Authorization: Bearer <CRON_SECRET>" with every scheduled call when a CRON_SECRET environment variable is set;
 * a call without it is refused, and if no CRON_SECRET is set at all the job refuses to run.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set on this deployment." }, { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  if (!sameSecret(header, `Bearer ${secret}`)) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  const result = await runMonthEndReminder();
  return NextResponse.json(result);
}
