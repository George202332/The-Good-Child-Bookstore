import type { CSSProperties } from "react";
import type { BookCategory } from "./taxonomy";

/**
 * One colour treatment per Category series, used by the home page's
 * "Shop by Category" tiles. Each tile gets a soft two-stop gradient
 * (`from` -> `to`), a border, and a dark text colour (`ink`). Every `ink`
 * has a contrast ratio of at least 8:1 against both gradient stops.
 * `accent` is the stripe colour used in dark mode, where the tile surface
 * itself goes neutral like the other tiles do. All ten hues are spaced round
 * the wheel and pinned by tests/category-colors.test.ts.
 */
export interface CategoryTheme {
  from: string;
  to: string;
  border: string;
  ink: string;
  accent: string;
}

export const CATEGORY_THEME: Record<BookCategory, CategoryTheme> = {
  // green
  "Adventure Series": { from: "#DFF6E7", to: "#A9E5BD", border: "#70CD8F", ink: "#0E341B", accent: "#42BD6B" },
  // blue
  "Education Series": { from: "#DAE9FB", to: "#9CC4F2", border: "#5899E4", ink: "#061F3C", accent: "#3E89E0" },
  // orange
  "Interactive Activity Series": { from: "#FEE9D7", to: "#F9C494", border: "#F0994C", ink: "#411F02", accent: "#EE862B" },
  // teal / aqua
  "Emotional Wellness and Mindfulness Series": { from: "#DCF9F8", to: "#A2EBE9", border: "#64D8D4", ink: "#0A3837", accent: "#2BABA7" },
  // yellow
  "Fun and Humor Series": { from: "#FFF7D6", to: "#FCE792", border: "#F5D247", ink: "#423500", accent: "#F3C716" },
  // pink
  "Values and Virtues Series": { from: "#FBDAE8", to: "#F29CC0", border: "#E45892", ink: "#3C061D", accent: "#E56198" },
  // indigo
  "Community and Society Series": { from: "#DDDEF8", to: "#A4A6EA", border: "#666AD6", ink: "#0B0C38", accent: "#5559D0" },
  // brown
  "Religion and Culture Series": { from: "#F5E7E0", to: "#E1BEAD", border: "#C79175", ink: "#321B10", accent: "#91583B" },
  // red
  "Holiday and Festivities": { from: "#FBDBDB", to: "#F09E9E", border: "#E05C5C", ink: "#3B0707", accent: "#D93A3A" },
  // lime
  "Diversity, Equity, and Inclusion": { from: "#F2F9DC", to: "#DBECA1", border: "#BEDA62", ink: "#2E3909", accent: "#A3C62F" },
};

/** Inline CSS variables consumed by `.cat-tile-themed` in app/site.css. */
export function categoryThemeStyle(cat: BookCategory): CSSProperties {
  const t = CATEGORY_THEME[cat];
  return {
    "--ct-from": t.from,
    "--ct-to": t.to,
    "--ct-border": t.border,
    "--ct-ink": t.ink,
    "--ct-accent": t.accent,
  } as CSSProperties;
}
