import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES } from "../lib/taxonomy";
import { CATEGORY_THEME } from "../lib/category-colors";

/**
 * Distinctness rule for the ten "Shop by Category" tiles:
 *  - every gradient stop, border and stripe (accent) colour is unique;
 *  - for any two stripe colours, either their HSL hues differ by >= 12
 *    degrees (circular distance), or, when the hues are that close, their
 *    HSL lightness differs by >= 12 percentage points;
 *  - ink contrast is >= 4.5:1 (WCAG AA) against both gradient stops.
 */
function hsl(hex: string): { h: number; l: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, l: l * 100 };
}
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe("category themes", () => {
  const themes = CATEGORIES.map((c) => ({ c, t: CATEGORY_THEME[c] }));

  test("ten themes with unique colours", () => {
    assert.equal(themes.length, 10);
    for (const key of ["from", "to", "border", "accent"] as const) {
      const vals = themes.map(({ t }) => t[key].toLowerCase());
      assert.equal(new Set(vals).size, 10, key);
    }
  });

  test("stripe colours are clearly distinguishable (hue >= 12deg or lightness >= 12)", () => {
    for (let i = 0; i < themes.length; i++) {
      for (let j = i + 1; j < themes.length; j++) {
        const a = hsl(themes[i].t.accent), b = hsl(themes[j].t.accent);
        const dh = Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h));
        const dl = Math.abs(a.l - b.l);
        assert.ok(dh >= 12 || dl >= 12, `${themes[i].c} vs ${themes[j].c}: dh=${dh.toFixed(1)} dl=${dl.toFixed(1)}`);
      }
    }
  });

  test("ink has >= 4.5:1 contrast on both gradient stops", () => {
    for (const { c, t } of themes) {
      assert.ok(contrast(t.ink, t.from) >= 4.5, c);
      assert.ok(contrast(t.ink, t.to) >= 4.5, c);
    }
  });
});
