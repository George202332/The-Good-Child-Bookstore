/**
 * Round 51 (Amendment 6) - READ-ONLY AUDIT of the printing costs the site shows against Lulu's real quotes.
 * It saves NOTHING and changes NOTHING. It only asks Lulu's cost calculator for quotes (no print jobs, no orders).
 *
 * For a spread of example books (page count, trim size, binding, paper, interior colour, print quality, cover
 * finish) it prints one table row with three figures:
 *   site estimate  - the fallback estimate in lib/lulu-pricing.ts (shown only before an interior is uploaded)
 *   Pricing quote  - what the Pricing section asks Lulu for (quotePrintingCostPerCopy, one copy)
 *   order quote    - what a real order saves as the printing cost (quoteLuluCosts, line cost, US address)
 * and flags every row where they differ by more than one cent. Then it lists, SEPARATELY, Lulu's shipping and
 * fulfilment charges to a few destination countries (these never enter the author's royalty).
 *
 * It uses the Lulu keys already saved on the site, so run it the way you run the other report scripts:
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/audit-lulu-costs.ts
 * It never prints any key.
 */
import { estimatePrintingCost } from "../lib/lulu-pricing";
import { quoteLuluCosts, quotePrintingCostPerCopy, podPackageForBook } from "../lib/payments/lulu";
import type { LuluAddress } from "../lib/lulu-order";

type Spec = { label: string; pages: number; trim: string; format: "paperback" | "hardcover"; binding?: string; color: string; quality: string; paper: string; finish: string };

const BASE = { trim: "0600X0900", color: "BW", quality: "STD", paper: "060UW444", finish: "M" };
const specs: Spec[] = [
  { label: "32pp B&W paperback", pages: 32, format: "paperback", ...BASE },
  { label: "100pp B&W paperback", pages: 100, format: "paperback", ...BASE },
  { label: "250pp B&W paperback", pages: 250, format: "paperback", ...BASE },
  { label: "32pp colour paperback", pages: 32, format: "paperback", ...BASE, color: "FC" },
  { label: "32pp colour premium paperback", pages: 32, format: "paperback", ...BASE, color: "FC", quality: "PRE", paper: "080CW444" },
  { label: "32pp colour gloss paperback", pages: 32, format: "paperback", ...BASE, color: "FC", finish: "G" },
  { label: "100pp cream paper paperback", pages: 100, format: "paperback", ...BASE, paper: "060UC444" },
  { label: "32pp 8.5x8.5 colour paperback", pages: 32, format: "paperback", ...BASE, trim: "0850X0850", color: "FC" },
  { label: "32pp 5x8 B&W paperback", pages: 32, format: "paperback", ...BASE, trim: "0500X0800" },
  { label: "100pp coil bound", pages: 100, format: "paperback", ...BASE, binding: "CO" },
  { label: "32pp B&W hardcover", pages: 32, format: "hardcover", ...BASE },
  { label: "100pp B&W hardcover", pages: 100, format: "hardcover", ...BASE },
  { label: "250pp B&W hardcover", pages: 250, format: "hardcover", ...BASE },
  { label: "32pp colour hardcover", pages: 32, format: "hardcover", ...BASE, color: "FC" },
  { label: "32pp 8.5x8.5 colour hardcover", pages: 32, format: "hardcover", ...BASE, trim: "0850X0850", color: "FC" },
];

const addr = (country_code: string, city: string, postcode: string, state_code?: string): LuluAddress => ({
  name: "Cost Quote", street1: "1 Quote Street", city, state_code, postcode, country_code, phone_number: "2125550100", email: "quote@example.com",
});
const countries: { name: string; a: LuluAddress }[] = [
  { name: "United States", a: addr("US", "New York", "10118", "NY") },
  { name: "United Kingdom", a: addr("GB", "London", "SW1A 1AA") },
  { name: "Canada", a: addr("CA", "Toronto", "M5V 2T6", "ON") },
  { name: "Australia", a: addr("AU", "Sydney", "2000", "NSW") },
  { name: "Kenya", a: addr("KE", "Nairobi", "00100") },
  { name: "Nigeria", a: addr("NG", "Lagos", "100001") },
];

const money = (n: number | null | undefined) => (n == null ? "n/a" : `$${n.toFixed(2)}`);
const metaOf = (s: Spec) => ({
  pages: s.pages, trimSizeCode: s.trim, interiorColor: s.color, printQuality: s.quality, paperType: s.paper, coverFinish: s.finish,
  binding: s.binding ?? "PB",
});

async function main() {
  console.log("PART 1 - printing cost per copy (shipping never included)\n");
  const rows: string[][] = [["Specs", "Site estimate", "Pricing quote", "Order quote", "Verdict"]];
  let mismatches = 0;
  for (const s of specs) {
    const meta = metaOf(s);
    const bindingCode = (s.format === "hardcover" ? "LW" : s.binding ?? "PB") as "PB" | "CO" | "LW";
    const estimate = estimatePrintingCost(bindingCode, s.pages);
    const pod = await podPackageForBook(meta as never, s.format, s.trim);
    const pricing = await quotePrintingCostPerCopy(pod, s.pages);
    const order = await quoteLuluCosts([{ title: s.label, format: s.format, quantity: 1, submissionMetadata: meta }], countries[0].a, "MAIL");
    const pq = pricing.ok ? pricing.cost : null;
    const oq = order.ok ? order.quote.lineCosts[0] : null;
    let verdict = "ok";
    if (pq == null || oq == null) verdict = `Lulu declined: ${pricing.ok ? "" : pricing.error} ${order.ok ? "" : order.error}`.trim();
    else if (Math.abs(pq - oq) > 0.01) verdict = "PRICING QUOTE != ORDER QUOTE";
    const lulu = oq ?? pq;
    if (lulu != null && Math.abs(estimate - lulu) > 0.01 && verdict === "ok") verdict = "estimate differs from Lulu";
    if (verdict !== "ok") mismatches++;
    rows.push([`${s.label} [${s.trim}, ${s.color}/${s.quality}, ${s.paper}, ${s.finish}]`, money(estimate), money(pq), money(oq), verdict]);
  }
  for (const r of rows) console.log(r.join("  |  "));
  console.log(`\n${mismatches} of ${specs.length} rows need a look.\n`);

  console.log("PART 2 - shipping and fulfilment to other countries (kept apart from the royalty), one 32pp B&W paperback, MAIL\n");
  const probe = specs[0];
  for (const c of countries) {
    const q = await quoteLuluCosts([{ title: probe.label, format: probe.format, quantity: 1, submissionMetadata: metaOf(probe) }], c.a, "MAIL");
    console.log(q.ok
      ? `${c.name}: printing ${money(q.quote.lineCosts[0])}, shipping ${money(q.quote.shippingCost)}, fulfilment ${money(q.quote.fulfillmentCost)}`
      : `${c.name}: Lulu did not quote (${q.error})`);
  }
  console.log("\nNothing was changed. Send the PART 1 table back to approve any correction.");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
