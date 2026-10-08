import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PayoutsTable } from "../app/admin/payouts/PayoutsTable";

/**
 * Static render of the real admin Payout Requests table. Round 26: the
 * checkboxes were all natively `disabled` on live data (Rolled / Live /
 * Paid rows), so clicks did nothing and no tick showed. No checkbox may
 * ever render disabled again, whatever the row status.
 */
type Rows = Parameters<typeof PayoutsTable>[0]["rows"];
const base = { userId: "u", accountNumber: "A1", email: "e@x.com", referralEarnings: 0, commissionEarnings: 0, reportMonthKey: "2026-09", requestedAt: new Date().toISOString() };
function mk(id: string, status: string, total: number, o: Record<string, unknown> = {}) {
  return { ...base, id, status, accountHolderName: `Name ${id}`, bookSalesEarnings: total, combinedTotal: total, paid: status === "PAID", ...o };
}
const rows = [
  mk("live-1", "LIVE", 8),
  mk("pending-r", "ON_HOLD", 12),
  mk("p1", "PAID", 100),
  mk("pending-s", "SCHEDULED", 45),
  mk("q1", "REQUESTED", 50),
  mk("pending-e", "SCHEDULED", 45, { componentIds: ["x"], paidComponentIds: ["x"] }),
  mk("rej", "REJECTED", 40),
] as unknown as Rows;

function render(canModerate: boolean) {
  const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} } as never;
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, createElement(PayoutsTable, { rows, canModerate })));
}

describe("admin payouts table render", () => {
  test("select-all plus one checkbox per row, none disabled", () => {
    const boxes = render(true).match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
    assert.equal(boxes.length, rows.length + 1);
    for (const b of boxes) assert.doesNotMatch(b, /disabled/);
  });

  test("checkboxes are hidden when the viewer cannot moderate", () => {
    assert.doesNotMatch(render(false), /type="checkbox"/);
  });

  test("the Report button is labelled Download with an accessible name, 70 x 27", () => {
    const html = render(true);
    assert.match(html, /aria-label="Download report for Name live-1"/);
    assert.match(html, /width:70px;height:27px/);
    assert.match(html, />Download</);
  });
});
