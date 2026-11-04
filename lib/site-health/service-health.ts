import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { deploymentOf } from "@/lib/runtime-env";
import { runAllServiceChecks, SERVICE_ORDER, type ServiceResult } from "@/lib/service-checks";
import { buildAlertEmail, decideAlert, type ServiceKey, type ServiceState } from "@/lib/site-health/service-state";

/**
 * Stores the latest result of every service check and decides, per service, whether an alert email is due
 * (rules in lib/site-health/service-state.ts). The latest picture is kept in two Setting rows:
 *   service_health_state  : { lastRunAt, results, states }
 *   health_alert_settings : { email }   (the alert address, set by the admin on the Site Health page)
 * and the full history is kept in two tables: ServiceCheck (one row per service per check) and ServiceIncident (one row per outage).
 * Staging runs the checks too; anything staging emails goes only to the staging test inbox (see lib/email.ts).
 */

const STATE_KEY = "service_health_state";
const ALERT_KEY = "health_alert_settings";
export const CHECK_EVERY_MINUTES = 5;

export interface ServiceHealthSnapshot {
  lastRunAt: string | null;
  results: ServiceResult[];
  states: Partial<Record<ServiceKey, ServiceState>>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function getAlertEmail(): Promise<string | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: ALERT_KEY } });
    const e = (row?.value as { email?: unknown } | null)?.email;
    return typeof e === "string" && EMAIL_RE.test(e.trim()) ? e.trim() : null;
  } catch {
    return null;
  }
}

export async function setAlertEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const e = email.trim();
  if (e && !EMAIL_RE.test(e)) return { ok: false, error: "That does not look like an email address." };
  try {
    await prisma.setting.upsert({ where: { key: ALERT_KEY }, update: { value: { email: e } }, create: { key: ALERT_KEY, value: { email: e } } });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save." };
  }
}

export async function readServiceHealth(): Promise<ServiceHealthSnapshot> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: STATE_KEY } });
    const v = row?.value as { lastRunAt?: string; results?: ServiceResult[]; states?: ServiceHealthSnapshot["states"] } | null;
    if (v) return { lastRunAt: v.lastRunAt ?? null, results: v.results ?? [], states: v.states ?? {} };
  } catch {
    // fall through
  }
  return { lastRunAt: null, results: [], states: {} };
}

/** Runs every check now, stores the results, and sends any alert that is due. Never throws. */
export async function runServiceHealth(opts: { alerts?: boolean } = {}): Promise<ServiceHealthSnapshot & { emailed: string[] }> {
  const deployment = deploymentOf();
  const sendAlerts = opts.alerts ?? true;
  const prev = await readServiceHealth();
  const nowIso = new Date().toISOString();
  const results = await runAllServiceChecks({ retry: true });
  const states: ServiceHealthSnapshot["states"] = {};
  const emailed: string[] = [];
  const to = sendAlerts ? await getAlertEmail() : null;

  for (const r of results) {
    const { next, action } = decideAlert(prev.states[r.key], { ok: r.ok, reason: r.reason }, nowIso);
    states[r.key] = next;
    if (action !== "none" && to) {
      const mail = buildAlertEmail({ action, label: r.label, reason: r.reason, since: next.since, nowIso });
      const sent = await sendEmail(to, mail.subject, mail.html).catch(() => ({ ok: false }));
      if (sent.ok) emailed.push(`${r.key}:${action}`);
      else console.error(`[service-health] could not send the ${action} alert for ${r.key}`);
    }
  }

  await recordHistory(results, states, nowIso, deployment);

  const value = JSON.parse(JSON.stringify({ lastRunAt: nowIso, results, states }));
  try {
    await prisma.setting.upsert({ where: { key: STATE_KEY }, update: { value }, create: { key: STATE_KEY, value } });
  } catch (err) {
    console.error("[service-health] could not save results", err instanceof Error ? err.message : "");
  }
  return { lastRunAt: nowIso, results, states, emailed };
}

/** Writes one ServiceCheck row per service and opens / closes outage rows. Never throws (history must not break the check). */
async function recordHistory(results: ServiceResult[], states: ServiceHealthSnapshot["states"], nowIso: string, deployment: string): Promise<void> {
  const at = new Date(nowIso);
  try {
    await prisma.serviceCheck.createMany({
      data: results.map((r) => ({ service: r.key, ok: r.ok, responseMs: r.responseMs ?? null, error: r.ok ? null : (r.reason ?? "no reason given").slice(0, 500), deployment, checkedAt: at })),
    });
    for (const r of results) {
      const open = await prisma.serviceIncident.findFirst({ where: { service: r.key, resolvedAt: null, deployment }, orderBy: { startedAt: "desc" } });
      if (!r.ok) {
        const err = (r.reason ?? "no reason given").slice(0, 500);
        if (open) await prisma.serviceIncident.update({ where: { id: open.id }, data: { lastError: err, checksFailed: { increment: 1 } } });
        else await prisma.serviceIncident.create({ data: { service: r.key, startedAt: at, firstError: err, lastError: err, checksFailed: 1, deployment } });
      } else if (open) {
        await prisma.serviceIncident.update({ where: { id: open.id }, data: { resolvedAt: at } });
      }
    }
  } catch (err) {
    console.error("[service-health] could not save history", err instanceof Error ? err.message : "");
  }
  void states;
}

export interface HistoryRow { id: string; service: string; ok: boolean; responseMs: number | null; error: string | null; checkedAt: Date }
export interface IncidentRow { id: string; service: string; startedAt: Date; resolvedAt: Date | null; firstError: string | null; lastError: string | null; checksFailed: number }

export async function readCheckHistory(opts: { page?: number; pageSize?: number; service?: string } = {}): Promise<{ rows: HistoryRow[]; total: number; pageSize: number; page: number }> {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 50, 1), 500);
  const page = Math.max(opts.page ?? 1, 1);
  const where = { deployment: deploymentOf(), ...(opts.service ? { service: opts.service } : {}) };
  try {
    const [rows, total] = await Promise.all([
      prisma.serviceCheck.findMany({ where, orderBy: { checkedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.serviceCheck.count({ where }),
    ]);
    return { rows, total, pageSize, page };
  } catch {
    return { rows: [], total: 0, pageSize, page };
  }
}

export async function readIncidents(limit = 200): Promise<IncidentRow[]> {
  try {
    return await prisma.serviceIncident.findMany({ where: { deployment: deploymentOf() }, orderBy: { startedAt: "desc" }, take: limit });
  } catch {
    return [];
  }
}

/** Used by the Site Health page: shows the stored results, running the checks first if they are older than 5 minutes. */
export async function ensureFreshServiceHealth(): Promise<ServiceHealthSnapshot> {
  const snap = await readServiceHealth();
  const age = snap.lastRunAt ? (Date.now() - Date.parse(snap.lastRunAt)) / 60000 : Infinity;
  if (age < CHECK_EVERY_MINUTES) return snap;
  return runServiceHealth();
}

export { SERVICE_ORDER };
