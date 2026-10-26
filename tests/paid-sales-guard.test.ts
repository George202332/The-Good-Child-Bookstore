import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guard: a sale line exists from the moment checkout starts (order still PENDING).
 * Reading sale lines "as is" would count unpaid checkouts as sales. Any place that
 * loads a user's/book's/link's sale lines must filter to PAID orders (lib/paid-sales.ts).
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

test("no code loads sale lines or referral earnings unfiltered", () => {
  const root = join(__dirname, "..");
  const offenders: string[] = [];
  for (const dir of ["actions", "app", "lib", "components"]) {
    for (const file of walk(join(root, dir))) {
      const text = readFileSync(file, "utf8");
      if (/(?<!select: \{ )\b(saleLines|authorReferralEarnings):\s*true\b/.test(text)) offenders.push(file.replace(root + "/", ""));
    }
  }
  assert.deepEqual(offenders, []);
});
