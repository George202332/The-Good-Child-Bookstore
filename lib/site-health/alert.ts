import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

/**
 * The single place every "something unexpected broke" path in the app
 * reports through, for the new admin Site Health page
 * (app/admin/site-health). One call does two things:
 *
 *   1. Writes a SystemErrorLog row (see prisma/schema.prisma) — the
 *      durable record Site Health's "API & backend health" and
 *      "Database health" cards read from.
 *   2. Sends an immediate email to support@thegoodchildbookstore.com
 *      via the existing sendEmail() (lib/email.ts, Resend) — not
 *      batched, not queued for a cron, right here in the same call —
 *      UNLESS the exact same error (by `signature`) already alerted
 *      within the last ALERT_DEDUP_MINUTES, in which case the log row
 *      is still written (so the dashboard's failure count stays
 *      accurate) but no second email goes out.
 *
 * This is the simplest robust dedup that actually matches the ask
 * ("don't send 500 identical emails if the same error fires 500 times
 * in a loop"): a short time-window check against the error's own
 * signature, no separate queue/worker, no extra table. A genuinely
 * different error (different source, or a different message) always
 * gets its own fresh alert — only an exact repeat gets throttled.
 *
 * Never throws: a reporting failure (DB down, email misconfigured)
 * must never take down the real action that's already failing. Every
 * call site here is already inside a catch block.
 */

export type SystemErrorSource = "CHECKOUT" | "PAYOUT" | "FILE_UPLOAD" | "AUTH" | "DATABASE" | "OTHER";

const ALERT_DEDUP_MINUTES = 15;
const SUPPORT_EMAIL = "support@thegoodchildbookstore.com";

/** Deterministic, short key for "is this the same error as before" —
 * normalized just enough that e.g. two file-upload failures for two
 * different files with the same underlying cause still dedup together,
 * while two genuinely different error messages don't. */
function signatureFor(source: SystemErrorSource, message: string): string {
  const normalized = message
    .toLowerCase()
    .replace(/[0-9a-f]{8,}/g, "<id>") // cuids/hashes/tokens vary per occurrence
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return `${source}:${normalized}`;
}

export async function reportSystemError(
  source: SystemErrorSource,
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const signature = signatureFor(source, message);

    const dedupSince = new Date(Date.now() - ALERT_DEDUP_MINUTES * 60 * 1000);
    const recentAlert = await prisma.systemErrorLog.findFirst({
      where: { signature, alertedAt: { gte: dedupSince } },
      orderBy: { alertedAt: "desc" },
    });
    const shouldAlert = !recentAlert;

    await prisma.systemErrorLog.create({
      data: {
        source,
        message: message.slice(0, 2000),
        signature,
        context: context ? (JSON.parse(JSON.stringify(context)) as object) : undefined,
        alertedAt: shouldAlert ? new Date() : null,
      },
    });

    if (!shouldAlert) return;

    const contextHtml = context
      ? `<pre style="white-space:pre-wrap;font-size:12px;background:#f4f4f4;padding:10px;border-radius:6px;">${escapeHtml(JSON.stringify(context, null, 2))}</pre>`
      : "";
    await sendEmail(
      SUPPORT_EMAIL,
      `[Site Health] ${source} error detected`,
      `<p>An error was just detected in the <strong>${escapeHtml(source)}</strong> pipeline.</p>
       <p style="font-family:monospace;background:#f4f4f4;padding:10px;border-radius:6px;">${escapeHtml(message)}</p>
       ${contextHtml}
       <p>Repeats of this exact error within ${ALERT_DEDUP_MINUTES} minutes won't send another email — check the Site Health page in the admin backend for the full, live picture.</p>`
    );
  } catch {
    // Reporting a system error must never itself crash the real action
    // that triggered it — see the module comment above.
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
