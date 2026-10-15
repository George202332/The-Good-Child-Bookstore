import test from "node:test";
import assert from "node:assert/strict";
import { currentMonthStart } from "../lib/month-range";

test("the month starts at midnight Nairobi time on the 1st", () => {
  const { start, label } = currentMonthStart(new Date("2026-10-15T18:00:00Z"));
  assert.equal(start.toISOString(), "2026-09-30T21:00:00.000Z");
  assert.equal(label, "October 2026");
});

test("late on the last day in UTC is already next month in Nairobi", () => {
  const { start, label } = currentMonthStart(new Date("2026-10-31T22:00:00Z"));
  assert.equal(start.toISOString(), "2026-10-31T21:00:00.000Z");
  assert.equal(label, "November 2026");
});
