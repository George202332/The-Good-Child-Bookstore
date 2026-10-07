import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { UNKNOWN_SHELF_ID, genreLabelFromShelfId, shelfIdFromGenreLabel } from "../lib/shelf-mapping";

describe("shelfIdFromGenreLabel", () => {
  test("canonical genres map to their shelf", () => {
    assert.equal(shelfIdFromGenreLabel("Picture Books"), "picture");
    assert.equal(shelfIdFromGenreLabel("Bedtime Stories"), "bedtime");
    assert.equal(shelfIdFromGenreLabel("Early Readers"), "early");
    assert.equal(shelfIdFromGenreLabel("Middle Grade"), "middle");
    assert.equal(shelfIdFromGenreLabel("Activity Books"), "activity");
  });
  test("legacy lower-case names still map", () => {
    assert.equal(shelfIdFromGenreLabel("Picture books"), "picture");
    assert.equal(shelfIdFromGenreLabel("Bedtime stories"), "bedtime");
    assert.equal(shelfIdFromGenreLabel("Middle grade"), "middle");
    assert.equal(shelfIdFromGenreLabel("Activity books"), "activity");
  });
  test("unknown values never silently become picture books", () => {
    assert.equal(shelfIdFromGenreLabel("Educational"), UNKNOWN_SHELF_ID);
    assert.equal(shelfIdFromGenreLabel(""), UNKNOWN_SHELF_ID);
    assert.equal(shelfIdFromGenreLabel(null), UNKNOWN_SHELF_ID);
    assert.equal(shelfIdFromGenreLabel(undefined), UNKNOWN_SHELF_ID);
  });
});

describe("genreLabelFromShelfId", () => {
  test("round-trips and blanks the unknown shelf", () => {
    assert.equal(genreLabelFromShelfId("picture"), "Picture Books");
    assert.equal(genreLabelFromShelfId("activity"), "Activity Books");
    assert.equal(genreLabelFromShelfId(UNKNOWN_SHELF_ID), "");
  });
});
