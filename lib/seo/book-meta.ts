import { clip, joinList, squash } from "@/lib/seo/text";

/**
 * A book's search title and description, written from the book's OWN data (title, subtitle, author, genre, category, subcategory,
 * age range, formats). Nothing is typed by hand and there is no generic fallback: the title and the author are always in both,
 * so no two books can share a title or description. A very thin page (nothing to say and no cover) asks to be no-indexed.
 */
export interface BookMetaInput {
  title: string;
  subtitle?: string | null;
  author: string;
  genre?: string | null;      // e.g. "Picture Books"
  category?: string | null;   // e.g. "Adventure Series"
  subcategory?: string | null;
  age?: string | null;        // e.g. "6-8"
  formats?: string[];         // e.g. ["eBook", "Paperback"]
  blurb?: string | null;
  hasCover?: boolean;
}

const SINGULAR: Record<string, string> = {
  "Picture Books": "picture book",
  "Bedtime Stories": "bedtime story",
  "Early Readers": "early reader",
  "Middle Grade": "middle grade book",
  "Activity Books": "activity book",
};
const kindOf = (genre?: string | null) => (genre && SINGULAR[genre]) || (genre ? genre.toLowerCase() : "children's book");

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 158;
export const DESCRIPTION_MIN = 70;

export function bookMetaTitle(i: BookMetaInput): string {
  const title = squash(i.title);
  const author = squash(i.author);
  const kind = kindOf(i.genre);
  const cap = kind.charAt(0).toUpperCase() + kind.slice(1);
  const age = i.age && i.age.trim() ? `Ages ${i.age.trim()}` : "";
  const options = [
    `${title} by ${author} | ${cap}${age ? `, ${age}` : ""}`,
    `${title} by ${author} | ${cap}`,
    `${title} by ${author}`,
  ];
  return options.find((o) => o.length <= TITLE_MAX) ?? clip(`${title} by ${author}`, TITLE_MAX);
}

export function bookMetaDescription(i: BookMetaInput): string {
  const title = squash(i.title);
  const sub = squash(i.subtitle);
  const author = squash(i.author);
  const kind = kindOf(i.genre);
  const article = /^[aeiou]/i.test(kind) ? "an" : "a";
  const where = i.subcategory ? ` about ${i.subcategory.toLowerCase()}` : i.category ? ` in the ${i.category} collection` : "";
  const age = i.age && i.age.trim() ? ` for ages ${i.age.trim()}` : "";
  const intro = `${title}${sub ? `: ${sub}` : ""} is ${article} ${kind}${where}${age}, by ${author}.`;
  const formats = (i.formats ?? []).filter(Boolean);
  const buy = formats.length ? ` Available as ${joinList(formats.map((f) => f.toLowerCase().replace("ebook", "eBook")))}.` : "";
  // The author's own words come first once there is room: the opening of the blurb, trimmed to whole words.
  const blurb = squash(i.blurb);
  let out = intro;
  const room = DESCRIPTION_MAX - intro.length - 1;
  if (blurb.length >= 40 && room >= 40) out = `${intro} ${clip(blurb, room)}`;
  else if (buy && intro.length + buy.length <= DESCRIPTION_MAX) out = `${intro}${buy}`;
  return out.length <= DESCRIPTION_MAX ? out : clip(out, DESCRIPTION_MAX);
}

/** True when the page has almost nothing to say: no real description and no cover. */
export function isThinBook(i: BookMetaInput): boolean {
  return squash(i.blurb).length < 30 && !i.hasCover;
}

export function bookMeta(i: BookMetaInput) {
  return { title: bookMetaTitle(i), description: bookMetaDescription(i), thin: isThinBook(i) };
}
