import { prisma } from "@/lib/prisma";
import { getPayoutLedger } from "@/actions/payout-ledger";

/**
 * Everything the admin Site Health page (app/admin/site-health) shows,
 * computed fresh on every page load. There's no APM/request-logging
 * infrastructure in this app (verified: grepping for anything that
 * writes one row per request turns up nothing — SystemErrorLog, added
 * alongside this page, is the first such table, and it only gets
 * written to by the specific pipelines wired up in
 * lib/site-health/alert.ts's callers, not by every route). So this
 * file is honest, on purpose, about the difference between:
 *   - a LIVE check this function actually runs right now (a DB
 *     round-trip, a count query, a static-route data check), and
 *   - a LOGGED count read back from SystemErrorLog/AuditLog, which
 *     only covers what's happened since those started being written
 *     to (this round) — not the site's full history.
 * Every category below says which kind each of its checks is, and the
 * page renders that distinction rather than papering over it.
 */

export type HealthStatus = "ok" | "warning" | "error";

export interface HealthCheck {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface HealthCategory {
  key: string;
  title: string;
  status: HealthStatus;
  /** One line on what kind of check this category is — live-right-now
   * vs. logged-since-this-round vs. a static one-time audit — shown
   * under the category heading so the dashboard never overstates what
   * it's actually showing. */
  methodology: string;
  checks: HealthCheck[];
}

function worstStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes("error")) return "error";
  if (statuses.includes("warning")) return "warning";
  return "ok";
}

function categoryFrom(key: string, title: string, methodology: string, checks: HealthCheck[]): HealthCategory {
  return { key, title, methodology, status: worstStatus(checks.map((c) => c.status)), checks };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// 1. API & backend health
// ---------------------------------------------------------------------------
async function getApiBackendHealth(): Promise<HealthCategory> {
  const checks: HealthCheck[] = [];

  // LIVE: time a real round trip through Prisma right now.
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const ms = Date.now() - started;
    checks.push({
      id: "db-roundtrip",
      label: "Database round-trip (live, just now)",
      status: ms > 1500 ? "warning" : "ok",
      detail: `${ms}ms for a SELECT 1 query.${ms > 1500 ? " Slower than the 1.5s warning threshold." : ""}`,
    });
  } catch (e) {
    checks.push({
      id: "db-roundtrip",
      label: "Database round-trip (live, just now)",
      status: "error",
      detail: `Query failed: ${e instanceof Error ? e.message : "unknown error"}`,
    });
  }

  // LOGGED: counts from SystemErrorLog, since this round's logging exists.
  const since24h = new Date(Date.now() - DAY_MS);
  const since1h = new Date(Date.now() - 60 * 60 * 1000);
  const [count24h, count1h, bySource] = await Promise.all([
    prisma.systemErrorLog.count({ where: { createdAt: { gte: since24h } } }),
    prisma.systemErrorLog.count({ where: { createdAt: { gte: since1h } } }),
    prisma.systemErrorLog.groupBy({ by: ["source"], _count: { source: true }, where: { createdAt: { gte: since24h } } }),
  ]);
  const breakdown = bySource.map((b: { source: string; _count: { source: number } }) => `${b.source}: ${b._count.source}`).join(", ") || "none";
  checks.push({
    id: "logged-errors-24h",
    label: "Logged errors, last 24h (checkout/payout/upload/auth pipelines only)",
    status: count24h === 0 ? "ok" : count24h > 10 ? "error" : "warning",
    detail: `${count24h} logged error(s) in the last 24h (${count1h} in the last hour). By source: ${breakdown}. This is NOT a full request-error-rate — only the specific pipelines wired to reportSystemError() write here.`,
  });

  return categoryFrom(
    "api-backend",
    "API & Backend Health",
    "Database round-trip: live, run right now. Error counts: logged by the specific pipelines wired to reportSystemError() since this page shipped — not a historical APM record.",
    checks
  );
}

// ---------------------------------------------------------------------------
// 2. Database health — connection + real integrity checks
// ---------------------------------------------------------------------------
async function getDatabaseHealth(): Promise<HealthCategory> {
  const checks: HealthCheck[] = [];

  // (a) The exact "released but unqueued" class of issue from the
  // payout-ledger fix — NOT treated as a bug by itself (the ledger
  // already surfaces these as "Pending" rows), just reported as a
  // live count for visibility.
  try {
    const ledger = await getPayoutLedger();
    const unqueuedCount = "error" in ledger ? null : ledger.filter((r) => r.status === "ON_HOLD" || r.status === "SCHEDULED").length;
    checks.push({
      id: "unqueued-balances",
      label: "Released-but-unqueued payout balances (live)",
      status: "ok",
      detail:
        unqueuedCount === null
          ? "Couldn't load the payout ledger to check."
          : `${unqueuedCount} account(s) with a released balance not yet queued into a PayoutRequest — already surfaced on the Payout Requests page as \"Rolled\" (still under the $30 minimum, rolling into next month's cycle) or \"Scheduled\" (crossed $30, ready and waiting to be paid), not a bug by itself.`,
    });
  } catch (e) {
    checks.push({ id: "unqueued-balances", label: "Released-but-unqueued payout balances (live)", status: "warning", detail: e instanceof Error ? e.message : "Couldn't check." });
  }

  // (b) Orphaned PayoutRequest -> missing WiseRecipient (a real
  // incident this app has already hit once — see payout-ledger.ts's
  // "Recipient deleted" fallback).
  const orphanPayoutRecipients = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint as count FROM "PayoutRequest" p
    WHERE NOT EXISTS (SELECT 1 FROM "WiseRecipient" w WHERE w.id = p."recipientId")
  `;
  const orphanPayoutCount = Number(orphanPayoutRecipients[0]?.count ?? 0);
  checks.push({
    id: "orphan-payout-recipient",
    label: "PayoutRequest rows pointing at a deleted payout recipient (live)",
    status: orphanPayoutCount > 0 ? "error" : "ok",
    detail: orphanPayoutCount > 0 ? `${orphanPayoutCount} payout request(s) reference a WiseRecipient that no longer exists.` : "None found.",
  });

  // (c) Orphaned SaleLine -> missing Book.
  const orphanSaleLines = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint as count FROM "SaleLine" s
    WHERE NOT EXISTS (SELECT 1 FROM "Book" b WHERE b.id = s."bookId")
  `;
  const orphanSaleLineCount = Number(orphanSaleLines[0]?.count ?? 0);
  checks.push({
    id: "orphan-saleline-book",
    label: "SaleLine rows with no resolvable Book (live)",
    status: orphanSaleLineCount > 0 ? "error" : "ok",
    detail: orphanSaleLineCount > 0 ? `${orphanSaleLineCount} sale line(s) reference a book that no longer exists — revenue history that can no longer be explained.` : "None found.",
  });

  // (d) PUBLISHED Book with zero BookFile rows at all.
  const publishedNoFiles = await prisma.book.count({
    where: { status: "PUBLISHED", files: { none: {} } },
  });
  checks.push({
    id: "published-no-files",
    label: "PUBLISHED books with zero file records (live)",
    status: publishedNoFiles > 0 ? "error" : "ok",
    detail: publishedNoFiles > 0 ? `${publishedNoFiles} published book(s) have no BookFile rows at all.` : "None found.",
  });

  // (e) PAID Order with zero SaleLine rows — paid but no line items.
  const paidNoLines = await prisma.order.count({
    where: { status: "PAID", lines: { none: {} } },
  });
  checks.push({
    id: "paid-order-no-lines",
    label: "PAID orders with zero sale lines (live)",
    status: paidNoLines > 0 ? "error" : "ok",
    detail: paidNoLines > 0 ? `${paidNoLines} order(s) are marked PAID but have no SaleLine rows — a confirmed payment with nothing recorded as sold.` : "None found.",
  });

  return categoryFrom(
    "database",
    "Database Health",
    "All checks here are live queries run right now, not a cached or historical record.",
    checks
  );
}

// ---------------------------------------------------------------------------
// 3. Auth & security
// ---------------------------------------------------------------------------
interface StaticRouteAudit {
  route: string;
  guarded: boolean;
  note?: string;
}

/**
 * STATIC audit, computed once by hand against the current codebase
 * (grepping every app/admin/**\/page.tsx for an authAdmin() call plus a
 * role check) — not a runtime filesystem scan. Reading this app's own
 * source files at request time isn't reliable once deployed to Vercel
 * (only the files Next.js actually traces into a route's serverless
 * bundle are guaranteed present), so this list is a snapshot, dated,
 * rather than a live scan. Re-run the same grep after adding a new
 * admin page and update AUDITED_AT below.
 */
const AUDITED_AT = "2026-10-03";
const ADMIN_ROUTE_AUDIT: StaticRouteAudit[] = [
  { route: "/admin", guarded: true },
  { route: "/admin/books", guarded: true },
  { route: "/admin/books/[id]", guarded: true },
  { route: "/admin/books/[id]/review", guarded: true },
  { route: "/admin/books/checklist-settings", guarded: true },
  { route: "/admin/blog", guarded: true },
  { route: "/admin/blog/[id]/review", guarded: true },
  { route: "/admin/seo-marketing", guarded: true },
  { route: "/admin/seo-marketing/indexing", guarded: true },
  { route: "/admin/google-infrastructure", guarded: true },
  { route: "/admin/analytics", guarded: true },
  { route: "/admin/api-management", guarded: true },
  { route: "/admin/site-settings", guarded: true },
  { route: "/admin/marketing", guarded: true },
  { route: "/admin/library", guarded: true },
  { route: "/admin/commission-settings", guarded: true, note: "Guard present, but redirects unauthorized visitors to /login (the reader/author login) instead of /admin/login — a cosmetic inconsistency, not a missing guard." },
  { route: "/admin/users", guarded: true },
  { route: "/admin/users/[id]", guarded: true },
  { route: "/admin/payouts", guarded: true },
  { route: "/admin/transactions", guarded: true },
  { route: "/admin/messages", guarded: true },
  { route: "/admin/messages/[userId]", guarded: true },
  { route: "/admin/login", guarded: false, note: "The sign-in page itself — correctly unguarded." },
];

async function getAuthSecurityHealth(): Promise<HealthCategory> {
  const checks: HealthCheck[] = [];

  // LOGGED: failed-login counts from the existing AuditLog table
  // (lib/audit-log.ts already wrote LOGIN_FAILED rows before this
  // round — reused rather than building a second log table).
  const since24h = new Date(Date.now() - DAY_MS);
  const since7d = new Date(Date.now() - 7 * DAY_MS);
  const [failed24h, failed7d, recentFailed] = await Promise.all([
    prisma.auditLog.count({ where: { action: "LOGIN_FAILED", createdAt: { gte: since24h } } }),
    prisma.auditLog.count({ where: { action: "LOGIN_FAILED", createdAt: { gte: since7d } } }),
    prisma.auditLog.findMany({
      where: { action: "LOGIN_FAILED" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { actor: { select: { email: true } } },
    }),
  ]);
  checks.push({
    id: "failed-logins",
    label: "Failed login attempts (logged)",
    status: failed24h > 25 ? "error" : failed24h > 5 ? "warning" : "ok",
    detail: `${failed24h} in the last 24h, ${failed7d} in the last 7 days. Most recent: ${
      recentFailed.length === 0
        ? "none"
        : recentFailed
            .map((r: { actor: { email: string }; createdAt: Date }) => `${r.actor.email} (${new Date(r.createdAt).toLocaleString()})`)
            .join("; ")
    }.`,
  });

  // STATIC AUDIT: admin route role-guard check, see ADMIN_ROUTE_AUDIT.
  const unguarded = ADMIN_ROUTE_AUDIT.filter((r) => !r.guarded && r.route !== "/admin/login");
  checks.push({
    id: "route-guard-audit",
    label: `Admin route role-guard audit (static, last reviewed ${AUDITED_AT})`,
    status: unguarded.length > 0 ? "error" : "ok",
    detail:
      unguarded.length > 0
        ? `${unguarded.length} admin route(s) appear to have no role guard: ${unguarded.map((r) => r.route).join(", ")}.`
        : `All ${ADMIN_ROUTE_AUDIT.length - 1} admin routes checked have a role guard. One cosmetic note: ${ADMIN_ROUTE_AUDIT.find((r) => r.note)?.route} ${ADMIN_ROUTE_AUDIT.find((r) => r.note)?.note ?? ""}`,
  });

  // LOGGED: unexpected AUTH errors from SystemErrorLog (distinct from
  // ordinary failed logins above).
  const authErrors24h = await prisma.systemErrorLog.count({ where: { source: "AUTH", createdAt: { gte: since24h } } });
  checks.push({
    id: "auth-system-errors",
    label: "Unexpected auth errors (logged, last 24h)",
    status: authErrors24h > 0 ? "error" : "ok",
    detail: authErrors24h > 0 ? `${authErrors24h} unexpected error(s) thrown inside login logic (not ordinary wrong-password attempts).` : "None found.",
  });

  return categoryFrom(
    "auth-security",
    "Authentication & Security",
    "Failed-login counts: logged live via the existing AuditLog table. Route-guard check: a static audit of the current codebase, dated above, not a live traffic scan (this app has no request-level traffic monitoring).",
    checks
  );
}

// ---------------------------------------------------------------------------
// 4. Payment & payout system status
// ---------------------------------------------------------------------------
async function getPayoutSystemHealth(): Promise<HealthCategory> {
  const checks: HealthCheck[] = [];

  // (a) PayoutRequest stuck in a non-terminal status too long.
  const stuckSince = new Date(Date.now() - 14 * DAY_MS);
  const stuck = await prisma.payoutRequest.findMany({
    where: { status: { in: ["REQUESTED", "APPROVED", "PROCESSING"] }, requestedAt: { lt: stuckSince } },
    select: { id: true, status: true, requestedAt: true },
  });
  checks.push({
    id: "stuck-payouts",
    label: "Payouts stuck in a non-terminal status 14+ days (live)",
    status: stuck.length > 0 ? "error" : "ok",
    detail: stuck.length > 0 ? `${stuck.length} payout request(s) still ${stuck.map((s: { status: string }) => s.status).join("/")} after 14+ days.` : "None found.",
  });

  // (a2) Duplicate payout rows — the same account with more than one
  // live (non-rejected) PayoutRequest of the same earnings type in the
  // same calendar month. queueDuePayouts only ever creates one per type
  // per month and payScheduledBalance is guarded the same way (see
  // lib/payout-guard.ts), so any hit here is a genuine duplicate — a
  // double-payment risk the admin ledger would otherwise just collapse
  // into one row (lib/payout-ledger-dedupe.ts). Checked on the RAW table,
  // not the ledger, precisely because the ledger hides duplicates.
  try {
    const dupes = await prisma.$queryRaw<{ userId: string; earningsType: string; period: string; count: bigint }[]>`
      SELECT p."userId" as "userId", p."earningsType" as "earningsType", to_char(p."requestedAt", 'YYYY-MM') as period, COUNT(*)::bigint as count
      FROM "PayoutRequest" p
      WHERE p.status::text <> 'REJECTED'
      GROUP BY p."userId", p."earningsType", to_char(p."requestedAt", 'YYYY-MM')
      HAVING COUNT(*) > 1
      LIMIT 20
    `;
    checks.push({
      id: "duplicate-payout-rows",
      label: "Duplicate payout rows — same account, same earnings type, same month (live)",
      status: dupes.length > 0 ? "error" : "ok",
      detail:
        dupes.length > 0
          ? `${dupes.length} account/period combination(s) have more than one non-rejected PayoutRequest (account ids: ${dupes.slice(0, 5).map((d) => `${d.userId} ${d.earningsType} ${d.period} x${Number(d.count)}`).join("; ")}). The admin ledger shows each account once, but the extra row(s) still exist and count against that person's balance — check them before paying anything, and reject the stray one.`
          : "None found.",
    });
  } catch (e) {
    checks.push({ id: "duplicate-payout-rows", label: "Duplicate payout rows — same account, same earnings type, same month (live)", status: "warning", detail: e instanceof Error ? e.message : "Couldn't check." });
  }

  // (b) Recent sales with a nonzero earner share but no matching
  // REVENUE_* notification — the exact class of bug notify-earners.ts
  // was written to fix; this catches it if that pipeline silently
  // fails again.
  // A SaleLine is created the moment checkout starts (createPendingOrder),
  // before payment is confirmed — its parent Order sits PENDING until
  // notifyRevenueEarners() actually runs on PAID confirmation, and stays
  // PENDING forever if the buyer abandons checkout (nothing in this app
  // ever flips an abandoned order to FAILED/CANCELLED). Without the
  // `order: { status: "PAID" }` filter here, every abandoned/never-paid
  // cart's SaleLine would correctly have no notification — it was never
  // actually paid for — and this check would misreport that as the
  // notify-earners pipeline having failed, rather than counting only the
  // sale lines that pipeline was ever supposed to notify.
  const since30d = new Date(Date.now() - 30 * DAY_MS);
  const recentEarningLines = await prisma.saleLine.findMany({
    where: {
      createdAt: { gte: since30d },
      order: { status: "PAID" },
      OR: [{ authorShare: { gt: 0 } }, { authorReferralShare: { gt: 0 } }, { affiliateShare: { gt: 0 } }],
    },
    select: { id: true, authorShare: true, authorReferralShare: true, affiliateShare: true, createdAt: true },
  });
  // FRESH re-investigation (this round) of Amendment 3 — the per-line
  // try/catch isolation in lib/payments/notify-earners.ts (an earlier
  // round's fix) genuinely stopped one failing recipient from taking
  // down its siblings' notifications, but THIS check never actually
  // verified that fix did its job: it only asked "does at least ONE
  // REVENUE_* notification exist for this sale line at all", not "does
  // EVERY earner this line actually owes money to have THEIR OWN
  // notification". A single SaleLine routinely owes money to MULTIPLE
  // people at once — an affiliate-referred sale pays the author's
  // royalty (REVENUE_ROYALTY) AND the promoting affiliate's commission
  // (REVENUE_PROMOTION) off the very same line, and can also carry a
  // separate referring affiliate's lifetime cut (REVENUE_REFERRAL) on
  // top of that. The old grouping collapsed all 3 notification types
  // into one Set keyed only by relatedRecordId, so a line where the
  // affiliate's notification succeeded but the author's failed (or any
  // other partial-failure combination) still counted as "has a
  // matching notification" and was never flagged — which is exactly
  // how this kept recurring even after the per-line isolation fix: that
  // fix stopped one failure from cascading, but a single isolated
  // failure on just one recipient of a multi-earner line was invisible
  // to this check the entire time.
  //
  // The fix: check each line against the SPECIFIC notification type(s)
  // it's actually supposed to have, one per nonzero share column, and
  // count a line as missing if ANY of its expected notifications isn't
  // there — not just when all of them are.
  let missingNotifications = 0;
  if (recentEarningLines.length > 0) {
    const lineIds = recentEarningLines.map((l: { id: string }) => l.id);
    const existingNotifs = await prisma.notification.findMany({
      where: { relatedRecordId: { in: lineIds }, type: { in: ["REVENUE_ROYALTY", "REVENUE_REFERRAL", "REVENUE_PROMOTION"] } },
      select: { relatedRecordId: true, type: true },
    });
    const notifiedTypesByLine = new Map<string, Set<string>>();
    for (const n of existingNotifs as { relatedRecordId: string | null; type: string }[]) {
      if (!n.relatedRecordId) continue;
      const set = notifiedTypesByLine.get(n.relatedRecordId) ?? new Set<string>();
      set.add(n.type);
      notifiedTypesByLine.set(n.relatedRecordId, set);
    }
    missingNotifications = recentEarningLines.filter((l: { id: string; authorShare: unknown; authorReferralShare: unknown; affiliateShare: unknown }) => {
      const have = notifiedTypesByLine.get(l.id) ?? new Set<string>();
      if (Number(l.authorShare) > 0 && !have.has("REVENUE_ROYALTY")) return true;
      if (Number(l.authorReferralShare) > 0 && !have.has("REVENUE_REFERRAL")) return true;
      if (Number(l.affiliateShare) > 0 && !have.has("REVENUE_PROMOTION")) return true;
      return false;
    }).length;
  }
  checks.push({
    id: "missing-earner-notifications",
    label: "Sales (last 30 days) missing an earner notification (live)",
    status: missingNotifications > 0 ? "error" : "ok",
    detail:
      missingNotifications > 0
        ? `${missingNotifications} of ${recentEarningLines.length} recent sale line(s) with a nonzero royalty/referral/commission share have no matching notification — the notify-earners pipeline may have failed for them.`
        : `All ${recentEarningLines.length} recent earning sale line(s) have a matching notification.`,
  });

  // (c) Basic sum reconciliation — total ever earned (from SaleLine)
  // vs total the payout ledger accounts for (live + unqueued + every
  // historical PayoutRequest, whatever its status). Not penny-perfect
  // (a REJECTED payout's amount is still counted as "accounted for"
  // here, since the money simply rolls back into the person's
  // available balance rather than vanishing) — a sanity check, not an
  // audit.
  try {
    // Same reasoning as the missing-earner-notifications check above:
    // only a PAID order's SaleLines are real, collected money that
    // should ever be "earned" by anyone — an abandoned/never-paid
    // cart's SaleLine has a real authorShare/affiliateShare computed
    // on it at checkout time, but counting that here would compare
    // this figure against a payout ledger that (correctly, after the
    // getPayoutLedger/fetchEarningsBreakdown fix) only ever accounts
    // for PAID-order money — an apples-to-oranges gap, not a real one.
    const [earnedAgg, ledger] = await Promise.all([
      prisma.saleLine.aggregate({
        where: { order: { status: "PAID" } },
        _sum: { authorShare: true, authorReferralShare: true, affiliateShare: true },
      }),
      getPayoutLedger(),
    ]);
    const totalEarned = Number(earnedAgg._sum.authorShare ?? 0) + Number(earnedAgg._sum.authorReferralShare ?? 0) + Number(earnedAgg._sum.affiliateShare ?? 0);
    if ("error" in ledger) {
      checks.push({ id: "reconciliation", label: "Payout ledger sum reconciliation (live)", status: "warning", detail: "Couldn't load the payout ledger to check." });
    } else {
      const ledgerTotal = ledger.reduce((sum, r) => sum + r.combinedTotal, 0);
      const diff = Math.abs(totalEarned - ledgerTotal);
      const tolerance = Math.max(1, totalEarned * 0.005);
      checks.push({
        id: "reconciliation",
        label: "Total earned vs. total accounted for in the payout ledger (live, sanity check only)",
        status: diff > tolerance ? "warning" : "ok",
        detail: `Total author/referral/affiliate shares ever earned (PAID orders only): $${totalEarned.toFixed(2)}. Total across the payout ledger's live + unqueued + historical rows: $${ledgerTotal.toFixed(2)}. Difference: $${diff.toFixed(2)}.${diff > tolerance ? " Outside the small rounding tolerance — worth a manual look, not necessarily a bug. Two known, legitimate (non-bug) sources of a gap here: (1) a REJECTED payout still counts here as \"accounted for\" even though that money rolls back into the person's balance (visible again once it re-queues, or in the ledger's \"On Hold\"/\"Scheduled\" rows in the meantime), and (2) a sale from the still-open current calendar month hasn't been released yet (it releases once that earnings month closes) and is correctly excluded from the on-hold/scheduled rows (not yet released) — it's still visible as part of that person's \"On Hold\" live-month row, just not countable as released money yet. If the gap persists well past the current month closing, it's worth investigating further." : ""}`,
      });
    }
  } catch (e) {
    checks.push({ id: "reconciliation", label: "Total earned vs. total accounted for in the payout ledger (live, sanity check only)", status: "warning", detail: e instanceof Error ? e.message : "Couldn't check." });
  }

  return categoryFrom(
    "payouts",
    "Payment & Payout System",
    "All checks here are live queries run right now against real sale/payout data.",
    checks
  );
}

// ---------------------------------------------------------------------------
// 5. File storage & uploads
// ---------------------------------------------------------------------------
async function getFileStorageHealth(): Promise<HealthCategory> {
  const checks: HealthCheck[] = [];

  // DB-level completeness: a PUBLISHED book enabled for eBook/print
  // should have a MANUSCRIPT BookFile; enabled for audiobook should
  // have an AUDIOBOOK BookFile. (A real HTTP HEAD request to confirm
  // the file URL actually resolves isn't attempted here — see the
  // module comment and the report for why.)
  type PublishedBookRow = { id: string; title: string; hasEbook: boolean; hasPrint: boolean; hasAudiobook: boolean; files: { kind: string }[] };
  const publishedBooks = (await prisma.book.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, title: true, hasEbook: true, hasPrint: true, hasAudiobook: true, files: { select: { kind: true } } },
  })) as PublishedBookRow[];
  const missingManuscript = publishedBooks.filter(
    (b) => (b.hasEbook || b.hasPrint) && !b.files.some((f) => f.kind === "MANUSCRIPT")
  );
  const missingAudiobook = publishedBooks.filter((b) => b.hasAudiobook && !b.files.some((f) => f.kind === "AUDIOBOOK"));

  checks.push({
    id: "missing-manuscript-file",
    label: "Published eBook/print books missing their MANUSCRIPT file (live)",
    status: missingManuscript.length > 0 ? "error" : "ok",
    detail:
      missingManuscript.length > 0
        ? `${missingManuscript.length} book(s): ${missingManuscript.slice(0, 5).map((b) => b.title).join(", ")}${missingManuscript.length > 5 ? "…" : ""}.`
        : `All ${publishedBooks.filter((b) => b.hasEbook || b.hasPrint).length} published eBook/print book(s) have a manuscript file on record.`,
  });
  checks.push({
    id: "missing-audiobook-file",
    label: "Published audiobook-enabled books missing their AUDIOBOOK file (live)",
    status: missingAudiobook.length > 0 ? "error" : "ok",
    detail:
      missingAudiobook.length > 0
        ? `${missingAudiobook.length} book(s): ${missingAudiobook.slice(0, 5).map((b) => b.title).join(", ")}${missingAudiobook.length > 5 ? "…" : ""}.`
        : `All ${publishedBooks.filter((b) => b.hasAudiobook).length} published audiobook-enabled book(s) have an audio file on record.`,
  });

  // LOGGED: file-upload failures from SystemErrorLog.
  const since24h = new Date(Date.now() - DAY_MS);
  const uploadErrors = await prisma.systemErrorLog.count({ where: { source: "FILE_UPLOAD", createdAt: { gte: since24h } } });
  checks.push({
    id: "upload-errors",
    label: "File upload errors (logged, last 24h)",
    status: uploadErrors > 0 ? "warning" : "ok",
    detail: uploadErrors > 0 ? `${uploadErrors} upload failure(s) logged in the last 24h.` : "None found.",
  });

  return categoryFrom(
    "file-storage",
    "File Storage & Uploads",
    "Live DB-completeness checks against actual book/file records — not a live HTTP check that each stored file URL actually resolves (not attempted here; see the report for why). Upload errors are logged live by uploadGenericFile().",
    checks
  );
}

// ---------------------------------------------------------------------------
// 6. General frontend / route health
// ---------------------------------------------------------------------------
async function getFrontendHealth(): Promise<HealthCategory> {
  const checks: HealthCheck[] = [];

  // This does NOT fetch the site's own pages over HTTP (no reliable
  // self-fetch target inside a serverless function, and it would be
  // slow) — instead it's a live check, right now, that the data each
  // dynamic public route actually depends on exists, which is the
  // realistic proxy available in this environment for "would this
  // route 404 or render empty".
  const [publishedBooks, publishedBlogs, categories] = await Promise.all([
    prisma.book.count({ where: { status: "PUBLISHED" } }),
    prisma.blog.count({ where: { status: "PUBLISHED" } }),
    prisma.category.count(),
  ]);
  checks.push({
    id: "dynamic-route-data",
    label: "Data backing the main dynamic routes (live)",
    status: publishedBooks === 0 ? "warning" : "ok",
    detail: `${publishedBooks} published book(s) (backs /[slug], /shop, /bookshelf), ${publishedBlogs} published post(s) (backs /blog), ${categories} categor(y/ies).${publishedBooks === 0 ? " No published books — most storefront routes would render empty, though not broken." : ""}`,
  });

  checks.push({
    id: "static-route-list",
    label: "Known public route patterns (static list, not individually fetched)",
    status: "ok",
    detail:
      "/, /shop, /bookshelf, /[slug], /authors, /blog, /about, /faq, /contact, /cart, /checkout, /checkout/return, /checkout/confirmation, /login, /signup, /forgot-password, /reset-password, /verify-email, /terms, /privacy, /returns, /subscription, /affiliate, /wishlist, /unsubscribe — this list is read off app/'s own route folders, not continuously re-verified by an actual page load.",
  });

  return categoryFrom(
    "frontend",
    "General Frontend",
    `Honest limitation: this is NOT a live browser check for broken links or console errors (no such tooling exists in this environment). It's a live data-completeness check standing in for that, plus a static route inventory. Last computed: just now, on this page load.`,
    checks
  );
}

export interface SiteHealthSnapshot {
  generatedAt: string;
  categories: HealthCategory[];
}

export async function getSiteHealthSnapshot(): Promise<SiteHealthSnapshot> {
  const categories = await Promise.all([
    getApiBackendHealth(),
    getDatabaseHealth(),
    getAuthSecurityHealth(),
    getPayoutSystemHealth(),
    getFileStorageHealth(),
    getFrontendHealth(),
  ]);
  return { generatedAt: new Date().toISOString(), categories };
}
