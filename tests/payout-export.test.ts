import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { PayoutLedgerRow } from "../actions/payout-ledger";
import { buildPayoutExportRows, buildPayoutExportTable, PAYOUT_EXPORT_HEADERS } from "../lib/payout-export";
import { buildPayoutBatchCsv } from "../lib/csv/payout-batch";
import { extractBankDetails } from "../lib/recipient-bank-details";

const BANK = { bankName: "Equity Bank", accountHolder: "Jane A. Doe", accountNumber: "0123456789", swiftOrRouting: "EQBLKENA", country: "Kenya" };

function ledgerRow(over: Partial<PayoutLedgerRow> & { id: string }): PayoutLedgerRow {
  return {
    userId: "u1",
    accountNumber: "ACC-001",
    accountHolderName: "Jane Doe",
    userName: "Jane Doe",
    bank: BANK,
    email: "jane@example.com",
    role: "AUTHOR",
    paymentMethod: "Bank transfer",
    accountDetails: "—",
    currency: "USD",
    bookSalesEarnings: 50,
    referralEarnings: 0,
    commissionEarnings: 0,
    combinedTotal: 50,
    reportMonthKey: "2026-09",
    status: "REQUESTED",
    paid: false,
    requestedAt: "2026-10-03T10:00:00.000Z",
    resolvedAt: null,
    isAffiliate: false,
    ...over,
  };
}

describe("payout export rows", () => {
  test("only released, >= $30, unpaid rows: Queued and Scheduled in; Rolled, Live, Paid, Rejected, Processing, and sub-$30 out", () => {
    const rows = [
      ledgerRow({ id: "q" }),
      ledgerRow({ id: "pending-u2", userId: "u2", status: "SCHEDULED", accountNumber: "ACC-002" }),
      ledgerRow({ id: "r", userId: "u3", status: "ON_HOLD", bookSalesEarnings: 12, combinedTotal: 12 }),
      ledgerRow({ id: "l", userId: "u4", status: "LIVE" }),
      ledgerRow({ id: "p", userId: "u5", status: "PAID", paid: true }),
      ledgerRow({ id: "x", userId: "u6", status: "REJECTED" }),
      ledgerRow({ id: "pr", userId: "u7", status: "PROCESSING" }),
      ledgerRow({ id: "small", userId: "u8", bookSalesEarnings: 20, combinedTotal: 20 }),
    ];
    assert.deepEqual(buildPayoutExportRows(rows).map((r) => r.accountId), ["ACC-001", "ACC-002"]);
  });

  test("one total per account; a merged Scheduled row exports only the released payable part, never the live month", () => {
    const merged = ledgerRow({ id: "pending-u1", status: "SCHEDULED", bookSalesEarnings: 45, combinedTotal: 45, unreleasedAmount: 8, payableAmount: 37, periodLabel: "Oct 2026 and earlier" });
    const [r] = buildPayoutExportRows([merged]);
    assert.equal(r.total, 37);
  });

  test("a Scheduled row pays only the wallet that clears $30 (affiliate $10 stays out)", () => {
    const row = ledgerRow({ id: "pending-u1", status: "SCHEDULED", bookSalesEarnings: 35, referralEarnings: 6, commissionEarnings: 4, combinedTotal: 45 });
    assert.equal(buildPayoutExportRows([row])[0].total, 35);
  });

  test("a partly paid row exports only what is still owed", () => {
    const row = ledgerRow({ id: "a", combinedTotal: 90, bookSalesEarnings: 50, referralEarnings: 10, commissionEarnings: 30, paidAmount: 50, componentIds: ["a", "b"], paidComponentIds: ["a"] });
    assert.equal(buildPayoutExportRows([row])[0].total, 40);
  });
});

describe("one shared table for CSV / Excel / PDF", () => {
  test("exact column structure: bank transfer only, one combined total, no royalties/affiliate/status/requested/PayPal columns", () => {
    assert.deepEqual([...PAYOUT_EXPORT_HEADERS], [
      "Account ID", "Account Name", "Email", "Bank Name", "Account Holder Name", "Account Number",
      "SWIFT Code / Routing Number", "Country", "Currency", "Total Amount to Be Paid",
    ]);
  });

  test("cells follow the headers; missing bank details are blank", () => {
    const rows = [ledgerRow({ id: "a" }), ledgerRow({ id: "b", userId: "u2", accountNumber: "ACC-002", bank: { bankName: "", accountHolder: "", accountNumber: "", swiftOrRouting: "", country: "" } })];
    const t = buildPayoutExportTable(rows);
    assert.deepEqual(t.body[0], ["ACC-001", "Jane Doe", "jane@example.com", "Equity Bank", "Jane A. Doe", "0123456789", "EQBLKENA", "Kenya", "USD", "50.00"]);
    assert.deepEqual(t.body[1], ["ACC-002", "Jane Doe", "jane@example.com", "", "", "", "", "", "USD", "50.00"]);
    assert.equal(t.grandTotal, 100);
  });

  test("the CSV is exactly the shared table (header + body, escaped)", () => {
    const rows = [ledgerRow({ id: "a", bank: { ...BANK, bankName: 'Bank, "Big"' } })];
    const lines = buildPayoutBatchCsv(rows).split("\n");
    assert.equal(lines[0], PAYOUT_EXPORT_HEADERS.join(","));
    assert.equal(lines[1], 'ACC-001,Jane Doe,jane@example.com,"Bank, ""Big""",Jane A. Doe,0123456789,EQBLKENA,Kenya,USD,50.00');
    assert.equal(lines.length, 2);
  });

  test("no due rows still yields a header-only file", () => {
    assert.equal(buildPayoutBatchCsv([]), PAYOUT_EXPORT_HEADERS.join(","));
  });
});

describe("extractBankDetails", () => {
  test("reads the same keys the admin user page reads, including legacy ones", () => {
    const b = extractBankDetails({
      type: "bank",
      accountHolderName: " Jane A. Doe ",
      details: { bankName: "Equity Bank", iban: "KE00X", swiftCode: "EQBLKENA", country: "Kenya" },
    });
    assert.deepEqual(b, { bankName: "Equity Bank", accountHolder: "Jane A. Doe", accountNumber: "KE00X", swiftOrRouting: "EQBLKENA", country: "Kenya" });
  });
  test("PayPal / M-Pesa recipients and missing recipients give blanks (bank only)", () => {
    const blank = { bankName: "", accountHolder: "", accountNumber: "", swiftOrRouting: "", country: "" };
    assert.deepEqual(extractBankDetails({ type: "email", accountHolderName: "J", details: { email: "j@x.com" } }), blank);
    assert.deepEqual(extractBankDetails({ type: "mpesa", accountHolderName: "J", details: { phoneNumber: "254" } }), blank);
    assert.deepEqual(extractBankDetails(null), blank);
  });
});
