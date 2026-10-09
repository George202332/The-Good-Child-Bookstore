import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  blogStatusLabel,
  blogStatusPillClass,
  canEdit,
  canWithdraw,
  canDelete,
  countBlogs,
  blogSummaryLine,
  blogDateInfo,
  deleteConfirmMessage,
  DELETE_CONFIRM,
  DELETE_PUBLISHED_CONFIRM,
} from "../lib/blog-status";

describe("blog status helpers", () => {
  test("labels", () => {
    assert.equal(blogStatusLabel("DRAFT"), "Draft");
    assert.equal(blogStatusLabel("PENDING_REVIEW"), "Pending Review");
    assert.equal(blogStatusLabel("PUBLISHED"), "Published");
    assert.equal(blogStatusLabel("WITHDRAWN"), "Withdrawn");
    assert.equal(blogStatusLabel("MYSTERY"), "MYSTERY");
  });
  test("pill classes", () => {
    assert.equal(blogStatusPillClass("DRAFT"), "status-draft");
    assert.equal(blogStatusPillClass("PENDING_REVIEW"), "status-review");
    assert.equal(blogStatusPillClass("PUBLISHED"), "status-published");
    assert.equal(blogStatusPillClass("REJECTED"), "status-attention");
    assert.equal(blogStatusPillClass("nope"), "status-draft");
  });
  test("action rules", () => {
    assert.equal(canEdit("DRAFT"), true);
    assert.equal(canEdit("REJECTED"), true);
    assert.equal(canEdit("PUBLISHED"), false);
    assert.equal(canEdit("PENDING_REVIEW"), false);
    assert.equal(canWithdraw("PUBLISHED"), true);
    assert.equal(canWithdraw("PENDING_REVIEW"), true);
    assert.equal(canWithdraw("DRAFT"), false);
    assert.equal(canWithdraw("WITHDRAWN"), false);
    assert.equal(canDelete("PUBLISHED"), true);
    assert.equal(canDelete("DRAFT"), true);
  });
  test("delete confirm is stronger for published", () => {
    assert.equal(deleteConfirmMessage("DRAFT"), DELETE_CONFIRM);
    assert.equal(deleteConfirmMessage("PUBLISHED"), DELETE_PUBLISHED_CONFIRM);
  });
  test("summary line", () => {
    const c = countBlogs(["PUBLISHED", "PUBLISHED", "PENDING_REVIEW", "DRAFT", "REJECTED"]);
    assert.deepEqual(c, { total: 5, published: 2, pending: 1, drafts: 1 });
    assert.equal(blogSummaryLine(c), "5 posts: 2 published, 1 pending review, 1 draft");
    assert.equal(blogSummaryLine(countBlogs(["DRAFT"])), "1 post: 0 published, 0 pending review, 1 draft");
  });
  test("date info", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const created = new Date("2026-01-01T00:00:00Z");
    assert.equal(blogDateInfo("PUBLISHED", new Date("2026-01-05T00:00:00Z"), created, now).primary, "published");
    assert.equal(blogDateInfo("PUBLISHED", new Date("2026-02-05T00:00:00Z"), created, now).primary, "scheduled");
    const pending = blogDateInfo("PENDING_REVIEW", new Date("2026-02-05T00:00:00Z"), created, now);
    assert.equal(pending.primary, "none");
    assert.equal(pending.date, null);
    assert.equal(pending.submitted, created);
  });
});
