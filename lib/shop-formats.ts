import type { Book } from "@/lib/data/catalog";

/**
 * The Bookshelf sidebar's "Format" filter. The four options are fixed —
 * they are the four formats the store sells — so the list never depends
 * on whatever books happen to be loaded (it used to be derived from the
 * static demo catalog, which is now empty, so the section rendered with
 * no options at all).
 *
 * The URL carries the format id (?format=ebook&format=paperback). A book
 * matches a ticked format when that format is actually purchasable for it
 * (Book.formatAvailable); several ticked formats match any of them, like
 * the other filters. The older ?format=print link (used by the home page's
 * "Shop print copies" button) still works and means Paperback or Hardcover.
 */
export type FormatId = "ebook" | "paperback" | "hardcover" | "audiobook";

export const FORMAT_OPTIONS: { id: FormatId; label: string }[] = [
  { id: "ebook", label: "eBook" },
  { id: "paperback", label: "Paperback" },
  { id: "hardcover", label: "Hardcover" },
  { id: "audiobook", label: "Audiobook" },
];

function normalise(raw: string): string {
  return raw.trim().toLowerCase();
}

/** The label for a ?format= value, for the active-filter chips. */
export function formatLabel(raw: string): string {
  const v = normalise(raw);
  if (v === "print") return "Print";
  return FORMAT_OPTIONS.find((o) => o.id === v)?.label ?? raw;
}

function hasFormat(book: Book, id: FormatId): boolean {
  // The static demo catalog (no formatAvailable) counts as having every format.
  if (!book.formatAvailable) return true;
  return book.formatAvailable[id];
}

/** Whether a book offers the ticked format (or, for the older "print"
 * value, either print format). Unknown values match nothing. */
export function bookMatchesFormat(book: Book, raw: string): boolean {
  const v = normalise(raw);
  if (v === "print") return hasFormat(book, "paperback") || hasFormat(book, "hardcover");
  if (v === "ebook" || v === "paperback" || v === "hardcover" || v === "audiobook") return hasFormat(book, v);
  return false;
}

export function bookMatchesAnyFormat(book: Book, ticked: Iterable<string>): boolean {
  for (const raw of ticked) if (bookMatchesFormat(book, raw)) return true;
  return false;
}
