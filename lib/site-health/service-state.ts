/**
 * Pure rules for WHEN a service-connection alert email is sent, so they are tested. One email when a service first fails, one
 * when it recovers, and a reminder only if it stays down for many hours. Never one email per check.
 */

export type ServiceKey = "database" | "migrations" | "site_address" | "vercel" | "paystack" | "paypal" | "lulu_auth" | "lulu_quote" | "lulu_files" | "lulu_order" | "email" | "storage" | "integrations";

export interface ServiceState {
  ok: boolean;
  /** When the current state (working / failing) began. */
  since: string;
  lastCheckedAt: string;
  /** Plain-words reason for the latest failure. Never contains a key. */
  reason?: string;
  /** An alert for the current outage has been handled (so a recovery email should follow). */
  alertedDown: boolean;
  /** When the last alert or reminder was sent for the current outage. */
  lastAlertAt?: string;
}

export type AlertAction = "none" | "down" | "recovered" | "reminder";

export const REMINDER_HOURS = 6;

export function decideAlert(
  prev: ServiceState | undefined,
  result: { ok: boolean; reason?: string },
  nowIso: string,
  reminderHours: number = REMINDER_HOURS,
): { next: ServiceState; action: AlertAction } {
  if (result.ok) {
    const next: ServiceState = { ok: true, since: prev?.ok ? prev.since : nowIso, lastCheckedAt: nowIso, alertedDown: false };
    return { next, action: prev && !prev.ok && prev.alertedDown ? "recovered" : "none" };
  }
  // failing
  if (!prev || prev.ok) {
    return { next: { ok: false, since: nowIso, lastCheckedAt: nowIso, reason: result.reason, alertedDown: true, lastAlertAt: nowIso }, action: "down" };
  }
  const lastAlert = prev.lastAlertAt ? Date.parse(prev.lastAlertAt) : Date.parse(prev.since);
  const hoursSince = (Date.parse(nowIso) - lastAlert) / 3_600_000;
  if (hoursSince >= reminderHours) {
    return { next: { ...prev, lastCheckedAt: nowIso, reason: result.reason, lastAlertAt: nowIso }, action: "reminder" };
  }
  return { next: { ...prev, lastCheckedAt: nowIso, reason: result.reason }, action: "none" };
}

export function hoursBetween(fromIso: string, toIso: string): number {
  return Math.max(0, Math.round(((Date.parse(toIso) - Date.parse(fromIso)) / 3_600_000) * 10) / 10);
}

export interface AlertEmail { subject: string; html: string }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The alert text. Says what failed and when; contains no secrets (the reason is built from status words only). */
export function buildAlertEmail(opts: { action: Exclude<AlertAction, "none">; label: string; reason?: string; since: string; nowIso: string; siteName?: string }): AlertEmail {
  const { action, label, reason, since, nowIso } = opts;
  const when = (iso: string) => `${iso.replace("T", " ").slice(0, 16)} UTC`;
  if (action === "recovered") {
    return {
      subject: `[Site Health] RECOVERED: ${label} is working again`,
      html: `<p><strong>${esc(label)}</strong> is working again.</p><p>It stopped working at ${when(since)} and was back at ${when(nowIso)} (about ${hoursBetween(since, nowIso)} hours).</p>`,
    };
  }
  const head = action === "down" ? `${label} has stopped working` : `${label} is STILL not working`;
  return {
    subject: `[Site Health] ${action === "down" ? "PROBLEM" : "STILL DOWN"}: ${label}`,
    html: `<p><strong>${esc(head)}.</strong></p><p>What failed: ${esc(label)}.<br/>Why: ${esc(reason ?? "no reason was given")}.<br/>First failed: ${when(since)}.${action === "reminder" ? `<br/>Down for about ${hoursBetween(since, nowIso)} hours.` : ""}</p><p>Open Admin &rarr; Site Health to see the live picture. You will get one email when it is working again, and a reminder every ${REMINDER_HOURS} hours while it stays down.</p>`,
  };
}
