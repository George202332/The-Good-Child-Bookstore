import { GENRES, GENRE_SHELF_ID, normalizeGenre } from "./taxonomy";

/** Shelf id used for a book whose genre cannot be mapped to any shelf. It
 * matches no `?cat=` value, so such a book only appears unshelved (all
 * books, series/subcategory filters and search) and never in a wrong shelf. */
export const UNKNOWN_SHELF_ID = "unknown";

/**
 * Genre value (the shelf name stored in the legacy Category join) -> shelf id
 * used by `/bookshelf?cat=`. Order: exact normalised genre ("Picture Books");
 * then the legacy fuzzy names older books carry ("Picture books", "Bedtime
 * stories", "Middle grade", ...); otherwise "unknown" — never "picture".
 * Legacy "Educational" has no shelf and maps to "unknown".
 */
export function shelfIdFromGenreLabel(label: string | null | undefined): string {
  const genre = normalizeGenre(label);
  if (genre) return GENRE_SHELF_ID[genre];
  const lower = (label ?? "").toLowerCase();
  if (lower.includes("picture")) return "picture";
  if (lower.includes("bedtime")) return "bedtime";
  if (lower.includes("early")) return "early";
  if (lower.includes("middle")) return "middle";
  if (lower.includes("activity")) return "activity";
  return UNKNOWN_SHELF_ID;
}

/** Canonical Genre display name for a shelf id ("picture" -> "Picture Books"),
 * or "" for the unknown shelf. */
export function genreLabelFromShelfId(shelfId: string): string {
  const genre = GENRES.find((g) => GENRE_SHELF_ID[g] === shelfId);
  return genre ?? "";
}
