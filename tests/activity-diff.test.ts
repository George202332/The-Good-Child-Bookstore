import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  maskTail,
  normalizeValue,
  diffFields,
  summarizeChanges,
  formatChangeLine,
  buildChangeMetadata,
  changeEventLines,
  payoutSnapshot,
  ACCOUNT_PROFILE_FIELDS,
  AUTHOR_PROFILE_FIELDS,
  PAYOUT_METHOD_FIELDS,
  type FieldSpec,
} from "../lib/activity-diff";
import { countryToIso2 } from "../lib/user-country";
import { buildUserActivityLogCsv } from "../lib/csv/user-activity-log";

describe("maskTail", () => {
  test("keeps only the last 4 characters", () => {
    assert.equal(maskTail("0123456789"), "****6789");
    assert.equal(maskTail(" DEUTDEFF500 "), "****F500");
  });
  test("never reveals a short value in full, and empty stays empty", () => {
    assert.equal(maskTail("1234"), "****");
    assert.equal(maskTail("12"), "****");
    assert.equal(maskTail(""), "");
  });
});

describe("normalizeValue", () => {
  test("null, undefined and blank are all empty", () => {
    assert.equal(normalizeValue(null), "");
    assert.equal(normalizeValue(undefined), "");
    assert.equal(normalizeValue("   "), "");
  });
  test("arrays, booleans, numbers", () => {
    assert.equal(normalizeValue(["a", " b ", ""]), "a, b");
    assert.equal(normalizeValue(true), "yes");
    assert.equal(normalizeValue(false), "no");
    assert.equal(normalizeValue(42), "42");
  });
});

describe("diffFields", () => {
  test("no changes -> empty (so no log entry is written)", () => {
    const snap = { name: "Ann", email: "a@x.com", country: "KE" };
    assert.deepEqual(diffFields(snap, { ...snap }, ACCOUNT_PROFILE_FIELDS), []);
    // whitespace / null vs empty are not changes
    assert.deepEqual(diffFields({ name: " Ann ", country: null }, { name: "Ann", country: "" }, ACCOUNT_PROFILE_FIELDS), []);
  });

  test("plain fields carry old -> new", () => {
    const c = diffFields({ name: "Ann", email: "a@x.com" }, { name: "Anna", email: "a@x.com" }, ACCOUNT_PROFILE_FIELDS);
    assert.deepEqual(c, [{ field: "name", label: "name", kind: "plain", from: "Ann", to: "Anna" }]);
  });

  test("masked fields never contain the full value", () => {
    const before = { accountNumber: "1234567890123", swiftOrRoutingCode: "DEUTDEFF500", mpesaPhone: "+254712345678" };
    const after = { accountNumber: "9999888877776", swiftOrRoutingCode: "DEUTDEFF", mpesaPhone: "+254799990000" };
    const changes = diffFields(before, after, PAYOUT_METHOD_FIELDS);
    assert.equal(changes.length, 3);
    for (const c of changes) {
      assert.equal(c.kind, "masked");
      assert.ok(c.from?.startsWith("****"));
      assert.ok(c.to?.startsWith("****"));
    }
    const json = JSON.stringify(changes);
    for (const secret of ["1234567890123", "9999888877776", "DEUTDEFF500", "+254712345678", "+254799990000"]) {
      assert.ok(!json.includes(secret), `leaked ${secret}`);
    }
    assert.equal(changes[0].from, "****0123");
    assert.equal(changes[0].to, "****7776");
  });

  test("a change in the middle of a masked value is still detected", () => {
    const c = diffFields({ accountNumber: "11112222" }, { accountNumber: "11119222" }, PAYOUT_METHOD_FIELDS);
    assert.equal(c.length, 1);
    assert.equal(c[0].from, "****2222");
    assert.equal(c[0].to, "****9222");
  });

  test("hidden fields log the field name only", () => {
    const c = diffFields({ gender: "Male" }, { gender: "Female" }, AUTHOR_PROFILE_FIELDS);
    assert.deepEqual(c, [{ field: "gender", label: "gender", kind: "hidden" }]);
  });

  test("secret-looking keys are forced hidden even when declared plain", () => {
    const specs: FieldSpec[] = [
      { key: "password", label: "password" },
      { key: "apiToken", label: "token" },
      { key: "cardNumber", label: "card" },
      { key: "clientSecret", label: "secret", kind: "plain" },
    ];
    const c = diffFields({ password: "old", apiToken: "a", cardNumber: "4111111111111111", clientSecret: "s1" }, { password: "new", apiToken: "b", cardNumber: "4000000000000002", clientSecret: "s2" }, specs);
    assert.equal(c.length, 4);
    for (const x of c) {
      assert.equal(x.kind, "hidden");
      assert.equal(x.from, undefined);
      assert.equal(x.to, undefined);
    }
    assert.ok(!JSON.stringify(c).includes("4111"));
  });

  test("long plain values are truncated", () => {
    const c = diffFields({ bio: "" }, { bio: "x".repeat(500) }, AUTHOR_PROFILE_FIELDS);
    assert.ok((c[0].to ?? "").length <= 83);
  });

  test("array fields compare by content", () => {
    assert.deepEqual(diffFields({ socialLinks: ["a", "b"] }, { socialLinks: ["a", "b"] }, AUTHOR_PROFILE_FIELDS), []);
    assert.equal(diffFields({ socialLinks: ["a"] }, { socialLinks: ["a", "b"] }, AUTHOR_PROFILE_FIELDS).length, 1);
  });
});

describe("summaries and metadata", () => {
  test("summarizeChanges names the fields", () => {
    const c = diffFields({ bankName: "A", swiftOrRoutingCode: "AAAA1111" }, { bankName: "B", swiftOrRoutingCode: "BBBB2222" }, PAYOUT_METHOD_FIELDS);
    assert.equal(summarizeChanges("Updated payout details", c), "Updated payout details: bank name, SWIFT / routing code changed");
  });

  test("buildChangeMetadata is null when nothing changed", () => {
    assert.equal(buildChangeMetadata("Updated profile", []), null);
  });

  test("formatChangeLine per kind", () => {
    assert.equal(formatChangeLine({ field: "name", label: "name", kind: "plain", from: "A", to: "B" }), 'name: "A" -> "B"');
    assert.equal(formatChangeLine({ field: "a", label: "account number", kind: "masked", from: "", to: "****1234" }), "account number: (empty) -> ****1234 (masked)");
    assert.equal(formatChangeLine({ field: "g", label: "gender", kind: "hidden" }), "gender: changed (value not recorded)");
  });

  test("changeEventLines tolerates garbage and reads back the summary first", () => {
    assert.deepEqual(changeEventLines(null), []);
    assert.deepEqual(changeEventLines(["x"]), []);
    assert.deepEqual(changeEventLines({ changes: [1, "x", { label: 3 }] }), []);
    const meta = buildChangeMetadata("Updated profile", diffFields({ name: "A" }, { name: "B" }, ACCOUNT_PROFILE_FIELDS), { x: 1 });
    const lines = changeEventLines(meta);
    assert.equal(lines[0], "Updated profile: name changed");
    assert.equal(lines[1], 'name: "A" -> "B"');
  });
});

describe("payoutSnapshot", () => {
  test("reads the keys PaymentDetailsSection saves", () => {
    const s = payoutSnapshot({
      type: "bank",
      currency: "usd",
      accountHolderName: "Ann",
      details: { bankName: "KCB", accountNumber: "123456789", swiftOrRoutingCode: "KCBLKENX", country: "Kenya", intermediaryBank: "Citi" },
    });
    assert.equal(s.bankName, "KCB");
    assert.equal(s.accountNumber, "123456789");
    assert.equal(s.swiftOrRoutingCode, "KCBLKENX");
    assert.equal(s.intermediaryBank, "Citi");
    assert.equal(s.currency, "USD");
    assert.equal(s.paypalEmail, "");
  });
  test("paypal and mpesa keys, and legacy bank keys", () => {
    assert.equal(payoutSnapshot({ type: "email", currency: "USD", accountHolderName: "A", details: { email: "a@pp.com" } }).paypalEmail, "a@pp.com");
    assert.equal(payoutSnapshot({ type: "mpesa", currency: "KES", accountHolderName: "A", details: { phoneNumber: "+254700000000" } }).mpesaPhone, "+254700000000");
    const legacy = payoutSnapshot({ type: "bank", currency: "GBP", accountHolderName: "A", details: { iban: "GB29NWBK60161331926819", sortCode: "60-16-13" } });
    assert.equal(legacy.accountNumber, "GB29NWBK60161331926819");
    assert.equal(legacy.swiftOrRoutingCode, "60-16-13");
  });
  test("adding a method logs every filled field, masked where needed", () => {
    const snap = payoutSnapshot({ type: "bank", currency: "USD", accountHolderName: "Ann", details: { bankName: "KCB", accountNumber: "123456789", swiftOrRoutingCode: "KCBLKENX", country: "Kenya" } });
    const c = diffFields({}, snap, PAYOUT_METHOD_FIELDS);
    assert.ok(c.some((x) => x.field === "accountNumber" && x.to === "****6789"));
    assert.ok(!JSON.stringify(c).includes("123456789"));
  });
});

describe("countryToIso2", () => {
  test("accepts codes and names, rejects unknown text", () => {
    assert.equal(countryToIso2("ke"), "KE");
    assert.equal(countryToIso2(" Kenya "), "KE");
    assert.equal(countryToIso2("Narnia"), null);
    assert.equal(countryToIso2(""), null);
    assert.equal(countryToIso2(null), null);
  });
});

describe("activity log CSV shows self-service events", () => {
  test("details column carries summary and masked field lines", () => {
    const meta = buildChangeMetadata(
      "Updated payout details (Bank transfer)",
      diffFields({ bankName: "A", accountNumber: "111122223333" }, { bankName: "B", accountNumber: "111122224444" }, PAYOUT_METHOD_FIELDS),
      { ip: "1.2.3.4" }
    );
    const out = buildUserActivityLogCsv([{ id: "e1", action: "PAYOUT_METHOD_UPDATED", createdAt: new Date("2026-10-06T10:00:00Z"), metadata: meta }]);
    const row = out.trimEnd().split("\r\n")[1];
    assert.ok(row.includes("Updated payout details,"));
    assert.ok(row.includes("bank name, account number changed"));
    assert.ok(row.includes("****4444"));
    assert.ok(!row.includes("111122224444"));
    assert.ok(row.includes("1.2.3.4"));
  });
});
