import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isPayoutDetailsLocked, payoutLockMessage, unlockDateLabel, resolvePayoutSchedule, failedPayoutMessage, nextCorrectionDeadlineLabel, DEFAULT_PAYOUT_SCHEDULE } from "../lib/payout-schedule";
import { computePayoutAmounts, withholdingRateFor, resolveWithholdingRates, isKenya } from "../lib/withholding";
import { bankFieldsForCountry, validateBankDetails } from "../lib/payout-bank-fields";
import { getCountrySupport } from "../lib/verto-support";
import { DEPARTMENTS, categoryForDepartment, departmentForCategory } from "../lib/message-departments";
import { buildPayoutStatementPdf } from "../lib/pdf/payout-statement";
import type { PayoutStatementData } from "../lib/payout-statement-data";

// Noon in Nairobi on the given day (UTC+3, so 09:00 UTC).
const nairobi = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 9, 0, 0));

describe("payout lock window", () => {
  const s = DEFAULT_PAYOUT_SCHEDULE;
  test("free until the 9th, locked 10th to 15th, free again from the 16th", () => {
    assert.equal(isPayoutDetailsLocked(s, nairobi(2026, 11, 9)), false);
    assert.equal(isPayoutDetailsLocked(s, nairobi(2026, 11, 10)), true);
    assert.equal(isPayoutDetailsLocked(s, nairobi(2026, 11, 12)), true);
    assert.equal(isPayoutDetailsLocked(s, nairobi(2026, 11, 15)), true);
    assert.equal(isPayoutDetailsLocked(s, nairobi(2026, 11, 16)), false);
    assert.equal(isPayoutDetailsLocked(s, nairobi(2026, 11, 28)), false);
  });
  test("the old 'after the 10th' rule is gone: the 20th is NOT locked", () => {
    assert.equal(isPayoutDetailsLocked(s, nairobi(2026, 11, 20)), false);
  });
  test("lock message shows the real unlock date and none of the old wording", () => {
    const m = payoutLockMessage(s, nairobi(2026, 11, 12));
    assert.equal(m, "Your payout details are locked while this month's payout is prepared. You can change them from 16 November.");
    assert.ok(!/cycle|next cycle/i.test(m));
  });
  test("dates follow the admin setting", () => {
    const custom = resolvePayoutSchedule({ payoutLockDay: 8, payoutReleaseDay: 20 });
    assert.equal(isPayoutDetailsLocked(custom, nairobi(2026, 11, 8)), true);
    assert.equal(isPayoutDetailsLocked(custom, nairobi(2026, 11, 21)), false);
    assert.equal(unlockDateLabel(custom, nairobi(2026, 11, 9)), "21 November");
  });
  test("unusable settings fall back to 10 and 15", () => {
    assert.deepEqual(resolvePayoutSchedule({ payoutLockDay: 20, payoutReleaseDay: 5 }), DEFAULT_PAYOUT_SCHEDULE);
    assert.deepEqual(resolvePayoutSchedule({ payoutLockDay: "x" }), DEFAULT_PAYOUT_SCHEDULE);
    assert.deepEqual(resolvePayoutSchedule(null), DEFAULT_PAYOUT_SCHEDULE);
  });
  test("failed payout message states the exact deadline and the payment day", () => {
    assert.equal(nextCorrectionDeadlineLabel(s, nairobi(2026, 11, 16)), "9 December");
    const m = failedPayoutMessage(s, nairobi(2026, 11, 16));
    assert.ok(m.includes("by 9 December"));
    assert.ok(m.includes("15 December"));
    assert.ok(m.includes("balance is safe"));
    assert.equal(nextCorrectionDeadlineLabel(s, nairobi(2026, 12, 3)), "9 December");
    assert.equal(nextCorrectionDeadlineLabel(s, nairobi(2026, 12, 20)), "9 January");
  });
});

describe("withholding tax", () => {
  test("5% for Kenya, 20% elsewhere, by profile country", () => {
    assert.equal(withholdingRateFor("KE"), 5);
    assert.equal(withholdingRateFor("Kenya"), 5);
    assert.equal(withholdingRateFor("US"), 20);
    assert.equal(withholdingRateFor(null), 20);
    assert.equal(isKenya(" ke "), true);
  });
  test("rates come from the admin setting", () => {
    assert.deepEqual(resolveWithholdingRates({ withholdingRateKenya: 3, withholdingRateOther: 15 }), { kenya: 3, other: 15 });
    assert.deepEqual(resolveWithholdingRates({ withholdingRateKenya: -4 }), { kenya: 5, other: 20 });
  });
  test("gross - tax - transaction cost = net, to the cent", () => {
    const a = computePayoutAmounts(123.45, 20, 1.5);
    assert.equal(a.tax, 24.69);
    assert.equal(a.net, 97.26);
    assert.equal(Math.round((a.gross - a.tax - a.transactionCost) * 100), Math.round(a.net * 100));
    const zero = computePayoutAmounts(0, 20, 0);
    assert.deepEqual([zero.gross, zero.tax, zero.transactionCost, zero.net], [0, 0, 0, 0]);
  });
});

describe("bank transfer fields and countries", () => {
  test("fields depend on the country", () => {
    assert.deepEqual(bankFieldsForCountry("US").map((f) => f.label), ["Bank Name", "Account Number", "ABA Routing Number"]);
    assert.deepEqual(bankFieldsForCountry("GB").map((f) => f.label), ["Bank Name", "Account Number", "Sort Code"]);
    assert.deepEqual(bankFieldsForCountry("DE").map((f) => f.label), ["Bank Name", "IBAN", "SWIFT / BIC Code"]);
    assert.deepEqual(bankFieldsForCountry("KE").map((f) => f.label), ["Bank Name", "Account Number", "SWIFT / BIC Code"]);
  });
  test("a missing field is reported", () => {
    assert.equal(validateBankDetails("KE", { bankName: "KCB", accountNumber: "123" }), "Enter your SWIFT / BIC Code.");
    assert.equal(validateBankDetails("KE", { bankName: "KCB", accountNumber: "123", swiftOrRoutingCode: "KCBLKENX" }), null);
  });
  test("a country we cannot pay gets a clear notice, never a form", async () => {
    const r = await getCountrySupport("IR");
    assert.equal(r.state, "unsupported");
    assert.equal((await getCountrySupport("KE")).state, "supported");
    assert.equal((await getCountrySupport("")).state, "unsupported");
  });
});

describe("message departments", () => {
  test("five departments, each with a badge colour and icon", () => {
    assert.deepEqual(DEPARTMENTS.map((d) => d.label), ["Editor", "Chief Editor", "Payouts", "Accounting", "Operations"]);
    for (const d of DEPARTMENTS) assert.ok(d.color && d.bg && d.icon);
  });
  test("departments map onto the older support categories so the admin Messages tab keeps working", () => {
    assert.equal(categoryForDepartment("PAYOUTS"), "PAYMENTS");
    assert.equal(categoryForDepartment("EDITOR"), "CONTENT");
    assert.equal(departmentForCategory("PAYMENTS"), "PAYOUTS");
    assert.equal(departmentForCategory(null), null);
  });
});

describe("payout statement PDF: original layout plus the small tax section at the bottom", () => {
  const base: PayoutStatementData = {
    authorName: "Test Reader", monthLabel: "Oct 2026", payoutDate: new Date(2026, 10, 15), status: "Pending payout",
    organicRevenue: 0, affiliateChannelRevenue: 0, referralCommission: 0, promotionCommission: 0, rolloverAmount: 0, totalPayout: 0,
    organicRows: [], affiliateRows: [], referralRows: [], promotionRows: [],
    tax: { rate: null, withholdingTax: 0, transactionCost: 0, netPaid: 0 },
  };
  test("no payout that month: a valid PDF with zeros in the tax section", async () => {
    const bytes = await buildPayoutStatementPdf(base);
    assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
  });
  test("a payout with tax recorded renders", async () => {
    const bytes = await buildPayoutStatementPdf({ ...base, totalPayout: 100, tax: { rate: 20, withholdingTax: 20, transactionCost: 1.5, netPaid: 78.5 } });
    assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
  });
});
