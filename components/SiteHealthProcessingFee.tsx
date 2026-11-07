import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getFeeRates, isUsingDefaultRates } from "@/lib/processing-fee-settings";
import { FEE_MISMATCH_THRESHOLD_USD, ROUTE_LABEL, type FeeRoute } from "@/lib/processing-fee";

/** Site Health: the Processing Fee rates in use, and a warning when the fee charged on a recent paid order differs from what the gateway really kept by more than the threshold. */
export async function SiteHealthProcessingFee() {
  const [rates, defaults] = await Promise.all([getFeeRates(), isUsingDefaultRates()]);
  let mismatches: { id: string; fee: number; cost: number; source: string | null; gap: number }[] = [];
  let checked = 0;
  let failed = false;
  try {
    const since = new Date(Date.now() - 60 * 24 * 3600 * 1000);
    const rows = await prisma.order.findMany({
      where: { status: "PAID", processingFeeAmount: { gt: 0 }, gatewayCostActual: { not: null }, createdAt: { gte: since }, isTestData: false },
      select: { id: true, processingFeeAmount: true, gatewayCostActual: true, gatewayCostSource: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    checked = rows.length;
    mismatches = rows
      .map((o) => ({ id: o.id, fee: Number(o.processingFeeAmount), cost: Number(o.gatewayCostActual), source: o.gatewayCostSource, gap: 0 }))
      .map((o) => ({ ...o, gap: Math.round((o.fee - o.cost) * 100) / 100 }))
      .filter((o) => o.source === "gateway" && Math.abs(o.gap) > FEE_MISMATCH_THRESHOLD_USD);
  } catch {
    failed = true;
  }
  const status = failed ? "warning" : mismatches.length > 0 || defaults ? "warning" : "ok";
  return (
    <div className="map-card" style={{ padding: 16, marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>Processing Fee</h3>
        <span className={`health-pill health-${status}`}>{status === "ok" ? "Matches" : "Needs attention"}</span>
      </div>
      <p style={{ fontSize: 13, margin: "0 0 8px" }}>
        Rates in use{defaults ? " (starting guesses, not yet confirmed)" : ""}:{" "}
        {(Object.keys(ROUTE_LABEL) as FeeRoute[]).map((r, i) => (
          <span key={r}>{i > 0 ? "; " : ""}<strong>{ROUTE_LABEL[r]}</strong> {(rates[r].rate * 100).toFixed(2)}%{rates[r].fixed > 0 ? ` + $${rates[r].fixed.toFixed(2)}` : ""}</span>
        ))}
        . <Link href="/admin/processing-fee-rates" style={{ fontWeight: 700 }}>Change rates</Link>
      </p>
      {defaults && <p style={{ fontSize: 13, color: "var(--coral-deep)", margin: "0 0 8px" }}>Check these against what Paystack and PayPal really charge you, then save them once.</p>}
      {failed && <p style={{ fontSize: 13, margin: 0 }}>Could not compare recent orders just now.</p>}
      {!failed && mismatches.length === 0 && <p style={{ fontSize: 13, margin: 0, color: "var(--admin-text-soft)" }}>Of {checked} recent paid print orders, none had a fee that differs from the gateway&apos;s real cost by more than ${FEE_MISMATCH_THRESHOLD_USD.toFixed(2)}.</p>}
      {mismatches.length > 0 && (
        <div style={{ fontSize: 13 }}>
          <p style={{ margin: "0 0 6px", fontWeight: 700 }}>{mismatches.length} recent order(s) where the fee charged differs from the gateway&apos;s real cost by more than ${FEE_MISMATCH_THRESHOLD_USD.toFixed(2)}. The rates above are probably out of date.</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {mismatches.slice(0, 8).map((m) => <li key={m.id}>Order #{m.id.slice(0, 8).toUpperCase()}: fee ${m.fee.toFixed(2)}, gateway kept ${m.cost.toFixed(2)} ({m.gap > 0 ? "over-charged" : "under-charged"} by ${Math.abs(m.gap).toFixed(2)})</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
