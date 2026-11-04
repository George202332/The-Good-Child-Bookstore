import test from "node:test";
import assert from "node:assert/strict";
import { isbnDigits13, ean13Modules } from "../lib/mockup/barcode";
import { bookDimensions } from "../lib/mockup/spec";

test("barcode: ISBN-10 converts, bad check digit rejected, 95 modules", () => {
  assert.equal(isbnDigits13("0-306-40615-2"), "9780306406157");
  assert.equal(isbnDigits13("9780306406158"), null);
  assert.equal(ean13Modules("9780306406157").length, 95);
});

test("hardcover is thicker than paperback for the same pages", () => {
  const base = { trimCode: "0600X0900", pages: 200, paperCode: "444" };
  assert.ok(bookDimensions({ ...base, format: "hardcover" }).t > bookDimensions({ ...base, format: "paperback" }).t);
});
