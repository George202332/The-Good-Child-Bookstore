import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  COMMENT_WEIGHT,
  HOME_BLOG_COUNT,
  MIN_ENGAGEMENT_SCORE,
  engagementScore,
  selectHomeBlogs,
} from "../lib/blog-ranking";

const NOW = new Date(2026, 9, 1);

function post(slug: string, day: number, reads = 0, comments = 0, publishAt: Date | null = null) {
  const created = new Date(2026, 8, day);
  return { slug, createdAt: created, publishAt: publishAt ?? created, reads, comments };
}

describe("engagementScore", () => {
  test("weights comments more than reads", () => {
    assert.equal(engagementScore({ reads: 4, comments: 2 }), 4 + COMMENT_WEIGHT * 2);
    assert.equal(engagementScore({ reads: 0, comments: 0 }), 0);
  });
});

describe("selectHomeBlogs", () => {
  test("fewer than 6 engaged posts shows the newest 6", () => {
    const posts = [
      post("a", 1, 500), post("b", 2, 400), post("c", 3), post("d", 4),
      post("e", 5), post("f", 6), post("g", 7), post("h", 8),
    ];
    const out = selectHomeBlogs(posts, NOW).map((p) => p.slug);
    assert.deepEqual(out, ["h", "g", "f", "e", "d", "c"]);
  });

  test("6 or more engaged posts shows the top 6 by score", () => {
    const posts = [
      post("p1", 1, 100), post("p2", 2, 90), post("p3", 3, 80), post("p4", 4, 70),
      post("p5", 5, 60), post("p6", 6, 50), post("p7", 7, 40), post("new", 20, 0),
    ];
    const out = selectHomeBlogs(posts, NOW).map((p) => p.slug);
    assert.deepEqual(out, ["p1", "p2", "p3", "p4", "p5", "p6"]);
  });

  test("score ties break by newest, then slug", () => {
    const posts = [
      post("old", 1, 20), post("b", 5, 20), post("a", 5, 20),
      post("c", 9, 20), post("d", 10, 20), post("e", 11, 20), post("f", 12, 20),
    ];
    const out = selectHomeBlogs(posts, NOW).map((p) => p.slug);
    assert.deepEqual(out, ["f", "e", "d", "c", "a", "b"]);
  });

  test("fewer than 6 posts total returns them all", () => {
    const out = selectHomeBlogs([post("a", 1), post("b", 2)], NOW).map((p) => p.slug);
    assert.deepEqual(out, ["b", "a"]);
    assert.deepEqual(selectHomeBlogs([], NOW), []);
  });

  test("exactly at the threshold counts as engaged", () => {
    const atThreshold = Array.from({ length: 6 }, (_, i) => post(`t${i}`, i + 1, MIN_ENGAGEMENT_SCORE));
    const fresh = post("fresh", 25, 0);
    const out = selectHomeBlogs([...atThreshold, fresh], NOW).map((p) => p.slug);
    assert.ok(!out.includes("fresh"));
    assert.equal(out.length, HOME_BLOG_COUNT);

    const below = Array.from({ length: 6 }, (_, i) => post(`t${i}`, i + 1, MIN_ENGAGEMENT_SCORE - 1));
    const out2 = selectHomeBlogs([...below, fresh], NOW).map((p) => p.slug);
    assert.equal(out2[0], "fresh");
  });

  test("comments are weighted when ranking", () => {
    const posts = [
      post("commented", 1, 0, 10),
      post("r1", 2, 25), post("r2", 3, 26), post("r3", 4, 27), post("r4", 5, 28), post("r5", 6, 29),
    ];
    const out = selectHomeBlogs(posts, NOW).map((p) => p.slug);
    assert.equal(out[0], "commented");
  });

  test("never returns duplicates or more than 6, and skips future posts", () => {
    const posts = [
      ...Array.from({ length: 10 }, (_, i) => post(`s${i}`, i + 1, 50)),
      post("s0", 1, 50),
      post("future", 2, 999, 0, new Date(2026, 11, 1)),
    ];
    const out = selectHomeBlogs(posts, NOW).map((p) => p.slug);
    assert.equal(out.length, HOME_BLOG_COUNT);
    assert.equal(new Set(out).size, out.length);
    assert.ok(!out.includes("future"));
  });
});
