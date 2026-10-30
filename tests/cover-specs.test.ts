import { test } from "node:test";
import assert from "node:assert/strict";
import { coverGuides, coverTemplateSvg } from "../lib/cover-specs";

const paperback = { format: "paperback" as const, widthIn: 12.375, heightIn: 9.25, spineIn: 0.125, trimWIn: 6, trimHIn: 9 };
const hardcover = { format: "hardcover" as const, widthIn: 13.75, heightIn: 10.625, spineIn: 0.25, trimWIn: 6, trimHIn: 9 };

test("paperback: the outer margin is the 0.125 in bleed, no wrap", () => {
  const g = coverGuides(paperback);
  assert.equal(g.outerIn, 0.125);
  assert.equal(g.bleedIn, 0.125);
  assert.equal(g.wrapIn, 0);
});

test("hardcover: the extra beyond the bleed is the wrap", () => {
  const g = coverGuides(hardcover);
  assert.equal(g.outerIn, 0.813);
  assert.equal(g.wrapIn, 0.688);
});

test("the template is a true-size SVG naming the spine and both covers", () => {
  const svg = coverTemplateSvg(coverGuides(hardcover), 120);
  assert.match(svg, /width="13.75in" height="10.625in"/);
  assert.match(svg, /BACK COVER/);
  assert.match(svg, /FRONT COVER/);
  assert.match(svg, /120 pages/);
});
