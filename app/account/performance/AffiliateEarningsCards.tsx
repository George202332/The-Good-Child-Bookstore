"use client";

import { useEffect, useState } from "react";
import { getAffiliateEarningsSummary, type AffiliateEarningsSummary } from "@/actions/affiliate-earnings-summary";

export function AffiliateEarningsCards({ initial }: { initial: AffiliateEarningsSummary }) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    const interval = setInterval(async () => {
      const fresh = await getAffiliateEarningsSummary();
      setData(fresh);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div style={{ textAlign: "right", fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 10 }}>Auto-refreshes every 10 seconds</div>
      <div className="stat-grid earnings-color-cards" style={{ marginBottom: 24 }}>
        <div className="stat-card stat-card-referral">
          <div className="stat-label">Referral earnings</div>
          <div className="stat-value">${data.referralEarnings.toFixed(2)}</div>
          <div className="stat-sub">3% of company revenue (25% of gross) from authors you referred</div>
        </div>
        <div className="stat-card stat-card-promotion">
          <div className="stat-label">Promotion earnings</div>
          <div className="stat-value">${data.promotionEarnings.toFixed(2)}</div>
          <div className="stat-sub">10% of list price on each book sold via your link</div>
        </div>
        <div className="stat-card stat-card-total">
          <div className="stat-label">Total affiliate earnings</div>
          <div className="stat-value">${data.totalEarnings.toFixed(2)}</div>
          <div className="stat-sub">All time; {data.earningEvents} earning events</div>
        </div>
        <div className="stat-card stat-card-due">
          <div className="stat-label">Due earnings</div>
          <div className="stat-value">${data.dueEarnings.toFixed(2)}</div>
          <div className="stat-sub">{data.dueDate ? `Payable ${data.dueDate}` : "Nothing due"}</div>
        </div>
      </div>
    </div>
  );
}
