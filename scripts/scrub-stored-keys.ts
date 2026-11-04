/**
 * Removes any API key that an OLD version of the admin once stored in the database (Setting row "site_settings", field apiKeys).
 * Keys now live only in Vercel. The site no longer reads or writes those stored copies.
 *
 * SAFE BY DEFAULT: with no option it only REPORTS which field NAMES are stored (never their values) and changes nothing.
 * Run it only after George approves the report:   npx tsx scripts/scrub-stored-keys.ts --apply
 * Keeps the plain shipping-method choice (luluShippingLevels). Take a Neon backup branch before using --apply.
 */
import { prisma } from "../lib/prisma";
import { describeDatabase } from "../lib/runtime-env";

async function main() {
  const db = describeDatabase(process.env.DATABASE_URL, process.env.DATABASE_LABEL);
  console.log(`Database: ${db ? `${db.endpoint} / ${db.database}` : "DATABASE_URL not set"}`);
  const row = await prisma.setting.findUnique({ where: { key: "site_settings" } });
  const v = row?.value as { apiKeys?: Record<string, unknown> } | null;
  const stored = Object.entries(v?.apiKeys ?? {}).filter(([k, val]) => k !== "luluShippingLevels" && val !== undefined && val !== null && val !== "").map(([k]) => k);
  console.log(stored.length ? `Stored key fields found (names only): ${stored.join(", ")}` : "No stored key fields found. Nothing to remove.");
  if (!stored.length || !process.argv.includes("--apply")) {
    if (stored.length) console.log("Nothing was changed. Re-run with --apply after you approve.");
    return;
  }
  const keep = v?.apiKeys?.luluShippingLevels;
  const value = JSON.parse(JSON.stringify({ ...v, apiKeys: keep !== undefined ? { luluShippingLevels: keep } : {} }));
  await prisma.setting.update({ where: { key: "site_settings" }, data: { value } });
  console.log("Removed the stored key fields.");
}
main().catch((e) => { console.error(e instanceof Error ? e.message : "failed"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
