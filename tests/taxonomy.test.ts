import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES, GENRES, SUBCATEGORIES, GENRE_SHELF_ID, isCategory, isGenre, subcategoriesFor,
  isSubcategoryOf, categoryOfSubcategory, categorySlug, categoryFromSlug, normalizeGenre,
} from "../lib/taxonomy";

describe("taxonomy", () => {
  test("ten categories, five genres", () => {
    assert.equal(CATEGORIES.length, 10);
    assert.deepEqual([...CATEGORIES].slice(8), ["Holiday and Festivities", "Diversity, Equity, and Inclusion"]);
    assert.equal(GENRES.length, 5);
    assert.deepEqual(Object.values(GENRE_SHELF_ID), ["picture", "bedtime", "early", "middle", "activity"]);
  });
  test("15-30 unique subcategories per category, globally unique", () => {
    const all = new Set<string>();
    for (const c of CATEGORIES) {
      const subs = SUBCATEGORIES[c];
      assert.ok(subs.length >= 15 && subs.length <= 30, c);
      assert.equal(new Set(subs).size, subs.length);
      for (const s of subs) { assert.ok(!all.has(s), s); all.add(s); }
    }
  });
  test("legacy words are available", () => {
    for (const w of ["Adventure","Fantasy","Friendship","Fable","Family Life","Nature","Humor","Gentle Mystery","Animal Story","Fairy Tale","Poetry","Educational"]) {
      assert.ok(categoryOfSubcategory(w), w);
    }
  });
  test("helpers", () => {
    assert.ok(isCategory("Adventure Series") && !isCategory("x"));
    assert.ok(isGenre("Picture Books") && !isGenre("Educational"));
    assert.deepEqual(subcategoriesFor("nope"), []);
    assert.ok(isSubcategoryOf("Values and Virtues Series", "Friendship"));
    assert.ok(!isSubcategoryOf("Adventure Series", "Friendship"));
    assert.equal(categoryOfSubcategory("Fable"), "Fun and Humor Series");
  });
  test("slugs round trip", () => {
    for (const c of CATEGORIES) assert.equal(categoryFromSlug(categorySlug(c)), c);
    assert.equal(categorySlug("Emotional Wellness and Mindfulness Series"), "emotional-wellness-and-mindfulness-series");
    assert.equal(categorySlug("Holiday and Festivities"), "holiday-and-festivities");
    assert.equal(categorySlug("Diversity, Equity, and Inclusion"), "diversity-equity-and-inclusion");
    assert.equal(new Set(CATEGORIES.map(categorySlug)).size, CATEGORIES.length);
    assert.equal(categoryFromSlug("zzz"), undefined);
  });
  test("new categories own their subcategories", () => {
    assert.equal(categoryOfSubcategory("Christmas"), "Holiday and Festivities");
    assert.equal(categoryOfSubcategory("Halloween"), "Holiday and Festivities");
    assert.equal(categoryOfSubcategory("Neurodiversity"), "Diversity, Equity, and Inclusion");
  });
  test("normalizeGenre", () => {
    assert.equal(normalizeGenre("Picture books"), "Picture Books");
    assert.equal(normalizeGenre(" bedtime  STORIES "), "Bedtime Stories");
    assert.equal(normalizeGenre("Middle grade"), "Middle Grade");
    assert.equal(normalizeGenre("Educational"), undefined);
    assert.equal(normalizeGenre(null), undefined);
  });
});
