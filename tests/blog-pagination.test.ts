import test from "node:test";
import assert from "node:assert/strict";
import { BLOG_PAGE_SIZE, blogListUrl, pageWindow, parsePageParam, searchTerms, totalPagesFor } from "../lib/blog-pagination";
import { headerSearchTarget, headerSearchUrl } from "../lib/header-search";

test("page size is 3 per row x 5 rows", () => {
  assert.equal(BLOG_PAGE_SIZE, 15);
});

test("parsePageParam is safe", () => {
  assert.equal(parsePageParam(undefined), 1);
  assert.equal(parsePageParam("0"), 1);
  assert.equal(parsePageParam("-4"), 1);
  assert.equal(parsePageParam("abc"), 1);
  assert.equal(parsePageParam("3"), 3);
  assert.equal(parsePageParam(["2", "9"]), 2);
});

test("totalPagesFor", () => {
  assert.equal(totalPagesFor(0), 1);
  assert.equal(totalPagesFor(15), 1);
  assert.equal(totalPagesFor(16), 2);
  assert.equal(totalPagesFor(45), 3);
});

test("pageWindow", () => {
  assert.deepEqual(pageWindow(1, 3), [1, 2, 3]);
  assert.deepEqual(pageWindow(1, 10), [1, 2, "gap", 10]);
  assert.deepEqual(pageWindow(5, 10), [1, "gap", 4, 5, 6, "gap", 10]);
  assert.deepEqual(pageWindow(10, 10), [1, "gap", 9, 10]);
});

test("blogListUrl keeps the search and omits page 1", () => {
  assert.equal(blogListUrl(1, ""), "/blog");
  assert.equal(blogListUrl(2, ""), "/blog?page=2");
  assert.equal(blogListUrl(1, "jane doe"), "/blog?q=jane+doe");
  assert.equal(blogListUrl(3, "jane"), "/blog?q=jane&page=3");
});

test("searchTerms splits words and caps them", () => {
  assert.deepEqual(searchTerms("  Jane   Doe "), ["Jane", "Doe"]);
  assert.deepEqual(searchTerms(undefined), []);
  assert.equal(searchTerms("a b c d e f g h").length, 6);
});

test("header search searches blogs only on the blog listing page", () => {
  assert.equal(headerSearchTarget("/blog"), "blog");
  assert.equal(headerSearchTarget("/blog/"), "blog");
  assert.equal(headerSearchTarget("/blog/my-post"), "books");
  assert.equal(headerSearchTarget("/bookshelf"), "books");
  assert.equal(headerSearchTarget("/"), "books");
  assert.equal(headerSearchTarget("/blogger"), "books");
  assert.equal(headerSearchTarget(null), "books");
});

test("headerSearchUrl targets the right page and resets paging", () => {
  assert.equal(headerSearchUrl("blog", "owl", "page=3"), "/blog?q=owl");
  assert.equal(headerSearchUrl("blog", "", "q=owl&page=2"), "/blog");
  assert.equal(headerSearchUrl("books", "owl", ""), "/bookshelf?q=owl");
  assert.equal(headerSearchUrl("books", "", "q=owl&genre=x"), "/bookshelf?genre=x");
});
