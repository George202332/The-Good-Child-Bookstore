import type { CSSProperties } from "react";
import type { BookCategory } from "./taxonomy";

/**
 * One colour treatment per Category series, used by the home page's
 * "Shop by Category" tiles. Each tile gets a soft two-stop gradient
 * (`from` -> `to`), a border, and a dark text colour (`ink`). Every `ink`
 * has a contrast ratio of at least 7:1 against both gradient stops.
 * `accent` is the stripe colour used in dark mode, where the tile surface
 * itself goes neutral like the other tiles do.
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
  "Adventure Series": { from: "#D5EFC9", to: "#A6D68F", border: "#86BF6E", ink: "#173D12", accent: "#6FBF52" },
  // blue
  "Education Series": { from: "#DFEAFB", to: "#B7CFF3", border: "#8FB0E3", ink: "#11285A", accent: "#5B8FDB" },
  // orange
  "Interactive Activity Series": { from: "#FDE3C8", to: "#F6BD85", border: "#E39C55", ink: "#4A2200", accent: "#EE8A2C" },
  // teal
  "Emotional Wellness and Mindfulness Series": { from: "#D2F0EE", to: "#9ADAD5", border: "#6FC2BC", ink: "#0A3A38", accent: "#2FB3AA" },
  // yellow / amber
  "Fun and Humor Series": { from: "#FFF1B8", to: "#FADB6A", border: "#E0BB3C", ink: "#403000", accent: "#F2C21B" },
  // pink / rose
  "Values and Virtues Series": { from: "#FBDDE6", to: "#F2AFC4", border: "#E38AA8", ink: "#5A1130", accent: "#E5648F" },
  // indigo
  "Community and Society Series": { from: "#DDE0F8", to: "#AEB6EC", border: "#8D98DE", ink: "#1A1F5C", accent: "#6573D6" },
  // brown / terracotta
  "Religion and Culture Series": { from: "#F0D9CB", to: "#D9A98F", border: "#C48A6C", ink: "#3F1C0D", accent: "#C0704D" },
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
