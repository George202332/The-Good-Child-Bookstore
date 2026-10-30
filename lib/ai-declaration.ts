/**
 * The AI use declaration. One per book, whatever formats it exists in, and one of exactly two
 * statements (two tick boxes working as a single choice). The text of the chosen statement is
 * what is stored and what the product page shows, so the wording is fixed here, in one place.
 */
export const AI_USED = "AI tools were used in creating this book, such as for text, artwork, or other parts.";
export const AI_NONE = "No AI tools were used. All content is entirely human-made.";

export type AiChoice = "ai" | "none" | "";

/** Which box a stored value corresponds to. An older written declaration matches neither box. */
export function aiChoiceOf(value: string | null | undefined): AiChoice {
  const v = (value ?? "").trim();
  if (v === AI_USED) return "ai";
  if (v === AI_NONE) return "none";
  return "";
}

export function aiTextFor(choice: AiChoice): string {
  return choice === "ai" ? AI_USED : choice === "none" ? AI_NONE : "";
}

export function isAiDeclaration(value: string | null | undefined): boolean {
  return aiChoiceOf(value) !== "";
}

/** Several editions of one book may each hold a value; the first one that is one of the two statements wins. */
export function firstAiDeclaration(...values: (string | null | undefined)[]): string {
  for (const v of values) if (isAiDeclaration(v)) return (v ?? "").trim();
  return "";
}

/** A free-text declaration written before the tick boxes existed (not one of the two statements). */
export function isLegacyAiText(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  return v.length > 0 && !isAiDeclaration(v);
}
