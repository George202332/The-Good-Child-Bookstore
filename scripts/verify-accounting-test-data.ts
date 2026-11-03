/**
 * Checks what the Accounting tab is made from, and says whether ALL of it is test (sandbox) data. Read only: it changes nothing.
 * Run it in your own terminal with DATABASE_URL pointing at the database you want to check:
 *   npx tsx scripts/verify-accounting-test-data.ts
 * It prints counts and short order references only (no names, emails or keys).
 */
import { prisma } from "../lib/prisma";
import { loadAccountingSource } from "../lib/accounting/data";
import { isPaymentTestMode } from "../lib/accounting/test-data";

async function main() {
  const [src, mode] = await Promise.all([loadAccountingSource(), isPaymentTestMode()]);
  const a = src.audit;
  console.log(`Payment mode: Paystack ${mode.paystack}, PayPal ${mode.paypal}  ->  the Accounting tab is labelled ${mode.test ? "TEST DATA" : "live"}.`);
  console.log(`Paid orders feeding the tab: ${a.paidOrders}`);
  console.log(`  test orders: ${a.testOrders} (flagged on the order: ${a.flaggedOnOrder}; found only from a test-mode payment: ${a.testByGatewayOnly})`);
  console.log(`  NOT test (real money): ${a.liveOrderCount}`);
  for (const o of a.liveOrders) console.log(`    #${o.ref}  ${o.date.slice(0, 10)}  $${o.total.toFixed(2)}`);
  console.log(`Archived test orders (currently left out): ${a.archivedTestOrders}`);
  console.log(`Expenses entered by an admin (not marked test or live): ${a.expenses}`);
  console.log(`Payout requests (not marked test or live): ${a.payoutRequests}`);
  console.log(a.allTest ? "\nRESULT: every paid order feeding the Accounting tab is test data." : `\nRESULT: ${a.liveOrderCount} paid order(s) are NOT test data. Check the list above.`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
