import test from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import {
  deleteNotificationsForRecords,
  prepareBlogNotificationCleanup,
  prepareBookNotificationCleanup,
  prepareReviewNotificationCleanup,
} from "../lib/notification-cleanup";

type Where = Record<string, unknown>;

function fakeDb(opts: { book?: unknown; reviews?: { id: string }[]; blog?: unknown; sameTitleBooks?: number; sameTitleBlogs?: number; failDelete?: boolean }) {
  const deletes: Where[] = [];
  const db = {
    notification: {
      deleteMany: async ({ where }: { where: Where }) => {
        if (opts.failDelete) throw new Error("boom");
        deletes.push(where);
        return { count: 1 };
      },
    },
    book: { findUnique: async () => opts.book ?? null, count: async () => opts.sameTitleBooks ?? 0 },
    review: { findMany: async () => opts.reviews ?? [] },
    blog: { findUnique: async () => opts.blog ?? null, count: async () => opts.sameTitleBlogs ?? 0 },
  };
  return { db: db as unknown as Prisma.TransactionClient, deletes };
}

test("deleteNotificationsForRecords removes by id and ignores blanks", async () => {
  const { db, deletes } = fakeDb({});
  await deleteNotificationsForRecords(["a", null, "a", undefined, "b"], db);
  assert.deepEqual(deletes, [{ relatedRecordId: { in: ["a", "b"] } }]);
  await deleteNotificationsForRecords([], db);
  assert.equal(deletes.length, 1);
});

test("a failed notification delete never throws", async () => {
  const { db } = fakeDb({ failDelete: true });
  await deleteNotificationsForRecords(["a"], db);
});

test("book cleanup removes book + review notifications and older untagged ones", async () => {
  const { db, deletes } = fakeDb({
    book: { title: "Owl Night", author: { user: { id: "u1" } } },
    reviews: [{ id: "r1" }, { id: "r2" }],
  });
  const cleanup = await prepareBookNotificationCleanup("b1", db);
  assert.equal(deletes.length, 0, "nothing is deleted before the book itself is");
  await cleanup();
  assert.deepEqual(deletes[0], { relatedRecordId: { in: ["b1", "r1", "r2"] } });
  const legacy = deletes[1] as { userId: string; relatedRecordId: null; title: { in: string[] } };
  assert.equal(legacy.userId, "u1");
  assert.equal(legacy.relatedRecordId, null);
  assert.ok(legacy.title.in.includes("Owl Night"));
  assert.ok(legacy.title.in.includes('Suspended: "Owl Night"'));
});

test("older untagged notifications are left alone when a same-titled sibling exists", async () => {
  const { db, deletes } = fakeDb({ book: { title: "Owl Night", author: { user: { id: "u1" } } }, sameTitleBooks: 1 });
  const cleanup = await prepareBookNotificationCleanup("b1", db);
  await cleanup();
  assert.equal(deletes.length, 1);
});

test("review cleanup removes that review's notification", async () => {
  const { db, deletes } = fakeDb({});
  const cleanup = await prepareReviewNotificationCleanup("r9", db);
  await cleanup();
  assert.deepEqual(deletes, [{ relatedRecordId: { in: ["r9"] } }]);
});

test("blog cleanup removes the post's notifications", async () => {
  const { db, deletes } = fakeDb({ blog: { title: "Hello", authorId: "u2" } });
  const cleanup = await prepareBlogNotificationCleanup("g1", db);
  await cleanup();
  assert.deepEqual(deletes[0], { relatedRecordId: { in: ["g1"] } });
  const legacy = deletes[1] as { userId: string; title: { in: string[] } };
  assert.equal(legacy.userId, "u2");
  assert.ok(legacy.title.in.includes('Published: "Hello"'));
});
