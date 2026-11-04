import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runServiceHealth } from "@/lib/site-health/service-health";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The scheduled service check. It is called on a timer by:
 *   - GitHub Actions every 5 minutes (.github/workflows/service-health.yml), and
 *   - Vercel's own daily cron (vercel.json) as a backstop,
 * both sending "Authorization: Bearer <CRON_SECRET>". A call without it is refused, and if no CRON_SECRET is set the job
 * refuses to run. It only READS from Paystack, PayPal, Lulu, Resend and the database (see lib/service-checks.ts).
 * Alerts are emailed from the live site only.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set on this deployment." }, { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  if (!sameSecret(header, `Bearer ${secret}`)) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  const snap = await runServiceHealth();
  return NextResponse.json({
    ranAt: snap.lastRunAt,
    results: snap.results.map((r) => ({ service: r.key, ok: r.ok, mode: r.mode, reason: r.ok ? undefined : r.reason })),
    emailed: snap.emailed,
  });
}
