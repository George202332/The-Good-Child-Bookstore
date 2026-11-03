import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { createNotification } from "@/lib/notify";
import { loadAccountingSource } from "@/lib/accounting/data";
import { buildSnapshot, isSnapshot, type MonthSnapshot } from "@/lib/accounting/service";
import { buildMonthlyReportPdf } from "@/lib/accounting/report-pdf";
import { dollars, type MonthCents } from "@/lib/accounting/calc";
import { isLastDayOfMonth, isMonthKey, monthKeyOf, monthLabel } from "@/lib/accounting/period";
import type { AccountingActor } from "@/lib/accounting/guard";

/**
 * Closing, reopening and sending the monthly report. Server only (not a "use server" file, so none of this can be called
 * from a browser; actions/accounting.ts is the only door, and it checks the role first).
 *
 * The report is NEVER sent unless an admin closes the month (or presses Re-send on a closed month).
 */

export interface CloseResult {
  ok: boolean;
  error?: string;
  /** Investors the report was emailed to. */
  sent?: number;
  /** Why the report was not (fully) sent, when the month closed but email did not go out. */
  reportNote?: string;
}

const FIGURE_NAMES: Record<string, string> = {
  salesRevenue: "Company sales revenue", acctGross: "Company author account earnings", totalRevenue: "Total revenue", georgeRoyalty: "Royalty to George Otieno",
  enteredExpenses: "Entered expenses", authorTax: "Tax on the author account", profit: "Profit", incomeTax: "Income tax", retained: "Retained", customersPaid: "Paid by customers",
};

export function diffFigures(before: MonthCents, after: MonthCents): { name: string; before: number; after: number }[] {
  const out: { name: string; before: number; after: number }[] = [];
  for (const [k, name] of Object.entries(FIGURE_NAMES)) {
    const b = (before as unknown as Record<string, number>)[k] ?? 0;
    const a = (after as unknown as Record<string, number>)[k] ?? 0;
    if (a !== b) out.push({ name, before: dollars(b), after: dollars(a) });
  }
  return out;
}

async function log(monthKey: string, actor: AccountingActor | { id: string; name: string }, action: string, summary: string, details?: unknown) {
  await prisma.accountingChangeLog.create({ data: { monthKey, action, actorId: actor.id, actorName: actor.name, summary, details: details === undefined ? undefined : (details as object) } });
}

export { log as writeChangeLog };

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Emails the month's PDF report to every active investor account. */
export async function sendMonthlyReport(monthKey: string, actor: { id: string; name: string }, mode: "close" | "resend"): Promise<{ sent: number; note?: string }> {
  const row = await prisma.accountingMonth.findUnique({ where: { monthKey } });
  if (!row || row.status !== "CLOSED" || !isSnapshot(row.snapshot)) return { sent: 0, note: "The month is not closed, so no report was sent." };
  const snap: MonthSnapshot = row.snapshot;
  const investors = await prisma.user.findMany({ where: { role: "INVESTOR", suspended: false }, select: { email: true, name: true } });
  if (investors.length === 0) {
    await log(monthKey, actor, "REPORT_NOT_SENT", "No investor accounts exist yet, so the report was not emailed to anyone.");
    return { sent: 0, note: "There are no investor accounts yet, so the report was not emailed to anyone. Add an investor in User Profiles, then press Re-send report." };
  }
  const corrected = row.reportVersion > 1;
  const label = monthLabel(monthKey);
  const pdf = await buildMonthlyReportPdf({ monthKey, snapshot: snap, version: row.reportVersion, closedAt: (row.closedAt ?? new Date()).toISOString(), closedBy: row.closedByName ?? "Admin" });
  const f = snap.figures;
  const subject = `${corrected ? "[CORRECTED] " : ""}The Good Child Bookstore: ${label} accounting report`;
  const lastChange = corrected
    ? await prisma.accountingChangeLog.findFirst({ where: { monthKey, action: "RECLOSED" }, orderBy: { createdAt: "desc" } })
    : null;
  const changes = Array.isArray((lastChange?.details as { changes?: unknown } | null)?.changes) ? ((lastChange!.details as { changes: { name: string; before: number; after: number }[] }).changes) : [];
  const html = `
    <p>${corrected ? `This is a <strong>corrected</strong> report for ${escapeHtml(label)}. It replaces the report sent earlier.` : `The ${escapeHtml(label)} accounting report is ready. The month has been closed and its figures are locked.`}</p>
    <table cellpadding="6" style="border-collapse:collapse;font-size:14px">
      <tr><td>Total revenue</td><td align="right"><strong>${usd(dollars(f.totalRevenue))}</strong></td></tr>
      <tr><td>Profit</td><td align="right"><strong>${usd(dollars(f.profit))}</strong></td></tr>
      <tr><td>Income tax (30% of profit)</td><td align="right">${usd(dollars(f.incomeTax))}</td></tr>
      <tr><td>Retained after tax</td><td align="right"><strong>${usd(dollars(f.retained))}</strong></td></tr>
    </table>
    ${changes.length ? `<p>What changed from the earlier report:</p><ul>${changes.map((c) => `<li>${escapeHtml(c.name)}: ${usd(c.before)} to ${usd(c.after)}</li>`).join("")}</ul>` : ""}
    ${snap.testOrders > 0 ? `<p><em>These figures include ${snap.testOrders} order(s) paid with test (sandbox) money.</em></p>` : ""}
    <p>The full report, with charts, the breakdown of all money received and the payouts summary, is attached as a PDF.</p>`;
  let sent = 0;
  let failed = 0;
  let firstError = "";
  for (const inv of investors) {
    const res = await sendEmail(inv.email, subject, html, { filename: `gcb-accounting-${monthKey}${corrected ? "-corrected" : ""}.pdf`, content: pdf });
    if (res.ok) sent++;
    else { failed++; firstError ||= res.error ?? "Email failed."; }
  }
  await prisma.accountingMonth.update({ where: { monthKey }, data: { lastReportSentAt: sent > 0 ? new Date() : row.lastReportSentAt, lastReportRecipients: sent } });
  await log(monthKey, actor, mode === "close" ? "REPORT_SENT" : "REPORT_RESENT", `${corrected ? "Corrected report" : "Report"} emailed to ${sent} investor${sent === 1 ? "" : "s"}${failed ? ` (${failed} failed)` : ""}.`, { sent, failed });
  return { sent, note: failed ? `${failed} email(s) could not be sent: ${firstError}` : undefined };
}

export async function closeMonthNow(actor: AccountingActor, monthKey: string, includeTest: boolean): Promise<CloseResult> {
  if (!isMonthKey(monthKey)) return { ok: false, error: "That is not a valid month." };
  if (monthKey > monthKeyOf(new Date())) return { ok: false, error: "A month that has not started yet cannot be closed." };
  const existing = await prisma.accountingMonth.findUnique({ where: { monthKey } });
  if (existing?.status === "CLOSED") return { ok: false, error: "This month is already closed." };
  const src = await loadAccountingSource();
  const snap = await buildSnapshot(src, monthKey, includeTest);
  const previous = existing && isSnapshot(existing.snapshot) ? existing.snapshot : null;
  const now = new Date();

  if (existing) {
    const claimed = await prisma.accountingMonth.updateMany({
      where: { monthKey, status: { not: "CLOSED" } },
      data: { status: "CLOSED", closedAt: now, closedByName: actor.name, snapshot: snap as unknown as object, reportVersion: existing.reportVersion + 1 },
    });
    if (claimed.count === 0) return { ok: false, error: "This month was just closed by someone else." };
  } else {
    try {
      await prisma.accountingMonth.create({ data: { monthKey, status: "CLOSED", closedAt: now, closedByName: actor.name, snapshot: snap as unknown as object, reportVersion: 1 } });
    } catch {
      return { ok: false, error: "This month was just closed by someone else." };
    }
  }
  if (previous) {
    const changes = diffFigures(previous.figures, snap.figures);
    await log(monthKey, actor, "RECLOSED", changes.length ? `Month closed again after correction. ${changes.map((c) => `${c.name} ${usd(c.before)} to ${usd(c.after)}`).join("; ")}.` : "Month closed again after correction. No figures changed.", { changes });
  } else {
    await log(monthKey, actor, "CLOSED", `Month closed. Total revenue ${usd(dollars(snap.figures.totalRevenue))}, profit ${usd(dollars(snap.figures.profit))}.`, { figures: snap.figures });
  }
  const res = await sendMonthlyReport(monthKey, actor, "close");
  return { ok: true, sent: res.sent, reportNote: res.note };
}

export async function reopenMonthNow(actor: AccountingActor, monthKey: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  if (!isMonthKey(monthKey)) return { ok: false, error: "That is not a valid month." };
  const why = reason.trim();
  if (why.length < 3) return { ok: false, error: "Please say why the month is being reopened." };
  if (why.length > 500) return { ok: false, error: "That reason is too long (500 characters at most)." };
  const row = await prisma.accountingMonth.findUnique({ where: { monthKey } });
  if (!row || row.status !== "CLOSED") return { ok: false, error: "This month is not closed." };
  const claimed = await prisma.accountingMonth.updateMany({
    where: { monthKey, status: "CLOSED" },
    data: { status: "OPEN", reopenedAt: new Date(), reopenedByName: actor.name, reopenReason: why },
  });
  if (claimed.count === 0) return { ok: false, error: "This month was just reopened by someone else." };
  const snap = isSnapshot(row.snapshot) ? row.snapshot : null;
  await log(monthKey, actor, "REOPENED", `Month reopened. Reason: ${why}`, { reason: why, lockedFigures: snap?.figures ?? null });
  return { ok: true };
}

export async function resendReportNow(actor: AccountingActor, monthKey: string): Promise<CloseResult> {
  if (!isMonthKey(monthKey)) return { ok: false, error: "That is not a valid month." };
  const row = await prisma.accountingMonth.findUnique({ where: { monthKey } });
  if (!row || row.status !== "CLOSED") return { ok: false, error: "Only a closed month has a report to send." };
  const res = await sendMonthlyReport(monthKey, actor, "resend");
  return { ok: true, sent: res.sent, reportNote: res.note };
}

/**
 * The end-of-month reminder. Run daily by the scheduled job (api/cron/accounting-reminder). On the LAST day of the month
 * (Nairobi time), if that month is still Open, every admin gets one notification. It never closes anything and never sends a report.
 */
export async function runMonthEndReminder(now: Date = new Date()): Promise<{ ran: boolean; reason: string; notified: number }> {
  if (!isLastDayOfMonth(now)) return { ran: false, reason: "Not the last day of the month.", notified: 0 };
  const monthKey = monthKeyOf(now);
  const row = await prisma.accountingMonth.findUnique({ where: { monthKey } });
  if (row?.status === "CLOSED") return { ran: false, reason: "The month is already closed.", notified: 0 };
  if (row?.reminderSentAt) return { ran: false, reason: "The reminder was already sent.", notified: 0 };
  // Claim the reminder so it is sent once even if the job runs twice.
  if (row) {
    const claimed = await prisma.accountingMonth.updateMany({ where: { monthKey, reminderSentAt: null, status: { not: "CLOSED" } }, data: { reminderSentAt: now } });
    if (claimed.count === 0) return { ran: false, reason: "The reminder was already sent.", notified: 0 };
  } else {
    try {
      await prisma.accountingMonth.create({ data: { monthKey, status: "OPEN", reminderSentAt: now } });
    } catch {
      return { ran: false, reason: "The reminder was already sent.", notified: 0 };
    }
  }
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", suspended: false }, select: { id: true } });
  for (const a of admins) {
    await createNotification(a.id, `Close ${monthLabel(monthKey)} accounting`, `Today is the last day of ${monthLabel(monthKey)} and the month is still open. Enter this month's expenses in Accounting, then press Close Month to lock the figures and send the report to investors.`, "ACCOUNTING");
  }
  return { ran: true, reason: "Reminder sent.", notified: admins.length };
}
