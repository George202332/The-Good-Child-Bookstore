/**
 * Age groups an author can choose for a book. An author may pick more than
 * one, but only neighbouring ones (6-8 with 9-12 is fine; 3-5 with 9-12 is not).
 *
 * Stored in Book.ageGroup as text, e.g. "6-8 years, 9-12 years". A single
 * group ("3-5 years") is stored exactly as it always was, so existing books
 * keep working untouched.
 */
export const AGE_TIERS = ["0-2", "3-5", "6-8", "9-12", "12-15"] as const;
export type AgeTier = (typeof AGE_TIERS)[number];

export const AGE_TIER_LABELS: Record<AgeTier, string> = {
  "0-2": "0-2 years",
  "3-5": "3-5 years",
  "6-8": "6-8 years",
  "9-12": "9-12 years",
  "12-15": "12-15 years",
};

/** Reads the stored text back into the groups it names, in age order. */
export function parseAgeGroups(value: string | null | undefined): AgeTier[] {
  const text = value ?? "";
  return AGE_TIERS.filter((t) => new RegExp(`(^|[^\\d-])${t}(?![\\d-])`).test(text));
}

/** The stored text for a selection ("6-8 years, 9-12 years"). */
export function serializeAgeGroups(tiers: readonly AgeTier[]): string {
  return AGE_TIERS.filter((t) => tiers.includes(t)).map((t) => AGE_TIER_LABELS[t]).join(", ");
}

/** True when the chosen groups sit next to each other with no gap. */
export function isConsecutiveAgeSelection(tiers: readonly AgeTier[]): boolean {
  if (tiers.length <= 1) return true;
  const idx = tiers.map((t) => AGE_TIERS.indexOf(t)).sort((a, b) => a - b);
  return idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
}

/** Why a stored/typed value is not acceptable, or null when it is fine. */
export function ageGroupProblem(value: string | null | undefined): string | null {
  const tiers = parseAgeGroups(value);
  if (tiers.length === 0) return "Choose at least one age group.";
  if (!isConsecutiveAgeSelection(tiers)) {
    return "Choose age groups that sit next to each other (for example 6-8 together with 9-12). You can't skip a group, such as 3-5 together with 9-12.";
  }
  return null;
}

/** One merged range for display: 6-8 + 9-12 -> "6-12". */
export function mergedAgeRange(tiers: readonly AgeTier[]): string {
  const ordered = AGE_TIERS.filter((t) => tiers.includes(t));
  if (ordered.length === 0) return "";
  const start = ordered[0].split("-")[0];
  const end = ordered[ordered.length - 1].split("-")[1];
  return `${start}-${end}`;
}
