import test from "node:test";
import assert from "node:assert/strict";
import { updateKindForStatus, trackingFromPrintJob, buyerUpdateText, ON_HOLD_TEXT, isOnHold } from "../lib/lulu-order-updates";
import { DEPARTMENTS, categoryForDepartment } from "../lib/message-departments";
import { isDepartmentKey, ALL_DEPARTMENT_KEYS } from "../lib/departments-server";

test("Lulu statuses map to buyer updates and nothing is invented", () => {
  assert.equal(updateKindForStatus("REJECTED"), "ON_HOLD");
  assert.equal(updateKindForStatus("production_delayed"), "ON_HOLD");
  assert.equal(updateKindForStatus("PRODUCTION_READY"), "IN_PROGRESS");
  assert.equal(updateKindForStatus("IN_PRODUCTION"), "IN_PROGRESS");
  assert.equal(updateKindForStatus("SHIPPED"), "SHIPPED");
  for (const s of ["CREATED", "UNPAID", "PAYMENT_IN_PROGRESS", "CANCELED", "DELIVERED", "PRINTED", "", null, undefined]) assert.equal(updateKindForStatus(s as string), null);
});

test("tracking link is read from Lulu's print job and only web addresses are used", () => {
  assert.deepEqual(trackingFromPrintJob({ line_items: [{ tracking_id: "ABC123", tracking_urls: ["https://track.example/ABC123"] }] }), { url: "https://track.example/ABC123", id: "ABC123" });
  assert.deepEqual(trackingFromPrintJob({ line_items: [{ tracking_urls: ["javascript:alert(1)"] }] }), { url: null, id: null });
  assert.deepEqual(trackingFromPrintJob(null), { url: null, id: null });
});

test("buyer update wording", () => {
  assert.match(buyerUpdateText("ON_HOLD", "Book", "ABCD1234").body, new RegExp(ON_HOLD_TEXT));
  assert.match(buyerUpdateText("SHIPPED", "Book", "ABCD1234", { url: "https://t.example/1", id: null }).body, /https:\/\/t\.example\/1/);
  assert.match(buyerUpdateText("IN_PROGRESS", "Book", "ABCD1234").subject, /ABCD1234/);
  assert.equal(isOnHold(new Date()), true);
  assert.equal(isOnHold(null), false);
});

test("five departments exist and keep the old support categories working", () => {
  assert.deepEqual(DEPARTMENTS.map((d) => d.key), ["EDITOR", "CHIEF_EDITOR", "PAYOUTS", "ACCOUNTING", "OPERATIONS"]);
  assert.deepEqual([...ALL_DEPARTMENT_KEYS], DEPARTMENTS.map((d) => d.key));
  assert.equal(isDepartmentKey("PAYOUTS"), true);
  assert.equal(isDepartmentKey("HACKER"), false);
  assert.equal(categoryForDepartment("EDITOR"), "CONTENT");
});
