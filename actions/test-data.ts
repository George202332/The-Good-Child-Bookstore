"use server";

import { prisma } from "@/lib/prisma";

const SITE_MODE_KEY = "site_data_mode";

/**
 * The site-wide data mode: when "test", every new account, book
 * submission, and order is automatically flagged as test data the
 * moment it's created — no manual marking needed afterward. Read from
 * anywhere in the app (signup, book submission, order creation) via
 * getSiteDataMode().
 *
 * This file previously also held the admin Data Management page's bulk
 * test-data tools (mark-as-test detection/preview, flag-apply, and a
 * "delete all test data" sweep, plus the toggle that set this mode).
 * That whole page was removed at George's request — deleting a
 * transaction/record now happens directly, inline, in the table it
 * lives in (Users, Transactions), so a separate bulk-cleanup screen was
 * redundant. This one read-only function survives because other parts
 * of the app (actions/auth.ts, actions/orders.ts,
 * actions/submissions.ts) still consult it to auto-flag new signups,
 * orders, and submissions while the site happens to be in test mode —
 * it just can no longer be changed from an admin screen. It defaults to
 * (and, with the toggle gone, permanently stays) "live" unless something
 * already set the underlying Setting row previously.
 */
export async function getSiteDataMode(): Promise<"live" | "test"> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: SITE_MODE_KEY } });
    const value = setting?.value as { mode?: string } | null;
    return value?.mode === "test" ? "test" : "live";
  } catch {
    return "live";
  }
}
