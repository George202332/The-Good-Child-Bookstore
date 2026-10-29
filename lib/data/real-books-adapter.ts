import { prisma } from "@/lib/prisma";
import { hashStr } from "@/lib/hash";
import { BOOKS, PALETTES, type Book, type MotifKind } from "@/lib/data/catalog";
import { parseAgeGroups, mergedAgeRange } from "@/lib/age-groups";
import { LULU_CONFIG } from "@/lib/lulu-config";
import { categoryOfSubcategory, type BookCategory } from "@/lib/taxonomy";
import { attributeCategory, countBooksByCategory, type CategoryAttributionInput } from "@/lib/category-counts";
import { groupEditions } from "@/lib/book-groups";
import { identifierFor, type IdentifierFormat } from "@/lib/identifiers";
import { genreLabelFromShelfId, shelfIdFromGenreLabel } from "@/lib/shelf-mapping";
import {
  effectiveRestrictedCountries,
  isBookVisibleToVisitor,
  headlinePrice,
  isFormatPurchasable,
  isRestrictedForCountries,
  isSellOnStoreDisabled,
  resolveFormatPrice,
} from "@/lib/book-visibility";

/**
 * Converts real, published Book rows (created through the actual
 * submission flow — see actions/submissions.ts) into the exact same
 * shape the static 50-book demo catalog uses, so every existing
 * storefront component (BookCard, the shop grid, the book detail page,
 * carousels) can render a real submitted book without being rewritten.
 *
 * Previously, submitted books never appeared anywhere a customer could
 * find them — the whole storefront only ever read from the static
 * catalog fixture. This is the fix: getStorefrontBooks() below returns
 * real published books first, filling out the rest of the grid with the
 * demo catalog so the site doesn't look empty while real titles are
 * still rare.
 *
 * A few fields on a real book don't have a direct equivalent yet
 * (motif/palette are purely decorative card theming, sizeMB/pages are
 * placeholders since real file metadata isn't tracked) — these are
 * derived deterministically from the book's own id so the same book
 * always gets the same look, rather than faked with random data.
 */

const MOTIF_KINDS: MotifKind[] = [
  "sun", "moon", "leaf", "star", "balloon", "cat", "fox", "boat",
  "rainbow", "tree", "owl", "cloud", "umbrella", "train", "heart", "dragon",
];

function ageFromAgeGroup(ageGroup: string | null | undefined): string {
  const tiers = parseAgeGroups(ageGroup);
  // One merged range for display (6-8 + 9-12 -> "6-12"); an unreadable or empty value keeps the old default.
  return tiers.length > 0 ? mergedAgeRange(tiers) : "3-5";
}

interface RealBookRow {
  id: string;
  title: string;
  description: string | null;
  isbn: string | null;
  price: unknown;
  coverImageUrl: string | null;
  slug: string;
  coverAltText: string | null;
  files: { kind: string; url: string }[];
  ageGroup: string | null;
  category: string | null;
  subcategory: string | null;
  restrictedCountries: string[];
  createdAt: Date;
  hasEbook: boolean;
  hasPrint: boolean;
  hasAudiobook: boolean;
  ebookPrice: unknown;
  paperbackPrice: unknown;
  hardcoverPrice: unknown;
  audiobookPrice: unknown;
  authorId: string;
  author: { user: { name: string } };
  categories: { category: { name: string } }[];
  genres: { genre: { name: string } }[];
  reviews: unknown[];
  ratings: { stars: number }[];
  submissionMetadata: unknown;
  language: string;
}

function toCatalogBook(row: RealBookRow): Book {
  const seed = hashStr(row.id);
  // Headline price: eBook, else audiobook, else paperback, else hardcover.
  const price = headlinePrice(row) ?? Number(row.price);
  const avgRating = row.ratings.length > 0 ? row.ratings.reduce((s, r) => s + r.stars, 0) / row.ratings.length : 0;
  const meta = (row.submissionMetadata as {
    affiliateEnabled?: boolean;
    includeInPromotions?: boolean;
    paperbackEnabled?: boolean;
    hardcoverEnabled?: boolean;
    paperbackRetailPrice?: number;
    hardcoverRetailPrice?: number;
    authorFirstName?: string;
    authorLastName?: string;
    pages?: number;
    dimensions?: string;
    fileSizeKB?: number;
    publisher?: string;
    trimSizeCode?: string;
    publicationDate?: string;
    aiDeclaration?: string;
  } | null) ?? null;
  // A print-only title is described by its chosen trim size (the real size of
  // the printed book); an eBook by the dimensions read from its manuscript.
  const printOnly = row.hasPrint && !row.hasEbook && !row.hasAudiobook;
  const trimLabel = LULU_CONFIG.trimSizes.find((t) => t.code === meta?.trimSizeCode)?.label;
  const submittedAuthorName = meta?.authorFirstName || meta?.authorLastName
    ? `${meta.authorFirstName ?? ""} ${meta.authorLastName ?? ""}`.trim()
    : null;
  // Same price rules as checkout (lib/book-visibility.ts resolveFormatPrice) so
  // what the product page shows is exactly what createPendingOrder charges.
  const paperbackPrice = resolveFormatPrice(row, "paperback");
  const hardcoverPrice = resolveFormatPrice(row, "hardcover");
  const audiobookUrl = row.files.find((f) => f.kind === "AUDIOBOOK")?.url;
  const audiobookPrice = resolveFormatPrice(row, "audiobook");
  const legacyTheme = row.genres[0]?.genre.name;
  const subcategory = row.subcategory?.trim() || (legacyTheme && categoryOfSubcategory(legacyTheme) ? legacyTheme : undefined);
  const shelfId = shelfIdFromGenreLabel(row.categories[0]?.category.name);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    // The name actually typed into the "Author" field at submission —
    // a pen name is fully supported and always wins when provided.
    // Falls back to the account's real name only for older
    // submissions (or print, which doesn't collect this field) that
    // never had this metadata in the first place.
    author: submittedAuthorName || row.author.user.name,
    authorId: row.authorId,
    motif: MOTIF_KINDS[seed % MOTIF_KINDS.length],
    palette: PALETTES[seed % PALETTES.length],
    category: shelfId,
    genre: genreLabelFromShelfId(shelfId),
    // Real Book.category, else the Category implied by the subcategory /
    // legacy Genre name, so older books (null category) still belong to a
    // series. The home page's counts use the same helper.
    series: attributeCategory({ category: row.category, subcategory, legacySubcategory: legacyTheme }),
    subcategory,
    restrictedCountries: effectiveRestrictedCountries(row),
    age: ageFromAgeGroup(row.ageGroup),
    ages: parseAgeGroups(row.ageGroup).length > 0 ? parseAgeGroups(row.ageGroup) : [ageFromAgeGroup(row.ageGroup)],
    price,
    formats: {
      ebook: resolveFormatPrice(row, "ebook") ?? price,
      print: hardcoverPrice ?? price,
      paperback: paperbackPrice ?? price,
      audiobook: audiobookPrice ?? price,
    },
    formatAvailable: {
      // Only a title that really has an eBook (a manuscript was submitted)
      // offers one: an audiobook-only title shows no eBook format at all.
      ebook: isFormatPurchasable(row, "ebook"),
      paperback: isFormatPurchasable(row, "paperback"),
      hardcover: isFormatPurchasable(row, "hardcover"),
      // Per explicit instruction: the Audiobook format is only ever
      // shown/purchasable once BOTH an audio file has been uploaded AND
      // a price has been set for it — missing either one, and the
      // Audiobook option is entirely absent from the product page, not
      // shown disabled/unavailable.
      audiobook: isFormatPurchasable(row, "audiobook"),
    },
    manuscriptUrl: row.files.find((f) => f.kind === "MANUSCRIPT")?.url,
    audiobookUrl,
    isbn: row.isbn ?? "",
    // The date the author actually entered at submission, when they set
    // one — falls back to when the row was created for older
    // submissions or books whose author left it blank.
    addedAt: row.createdAt.toISOString(),
    pubDate: meta?.publicationDate || row.createdAt.toISOString().slice(0, 10),
    sizeMB: (2 + (seed % 8)).toFixed(1),
    rating: avgRating.toFixed(1),
    reviews: row.reviews.length,
    // Real page count when the manuscript's was auto-detected (or the
    // author entered one) at submission — the seed-based placeholder
    // only covers older books submitted before this was captured.
    // 0 = the author never gave one; the product page then hides the field.
    pages: meta?.pages ?? 0,
    language: row.language,
    dimensions: printOnly ? (trimLabel ?? meta?.dimensions) : meta?.dimensions,
    publisher: meta?.publisher?.trim() || undefined,
    aiDeclaration: meta?.aiDeclaration,
    fileSizeKB: printOnly ? undefined : meta?.fileSizeKB,
    format: [row.hasEbook && "eBook", row.hasPrint && "Print", row.hasAudiobook && "Audiobook"].filter(Boolean).join(", ") || "eBook",
    blurb: row.description ?? "",
    featured: meta?.includeInPromotions ?? false,
    affiliateEnabled: meta?.affiliateEnabled ?? false,
    coverImage: row.coverImageUrl ?? undefined,
    coverAltText: row.coverAltText ?? undefined,
  };
}

type PrintIsbns = { paperback?: string; hardcover?: string };

function identifiersOf(row: RealBookRow): NonNullable<Book["identifiers"]> {
  const src = {
    isbn: row.isbn, hasEbook: row.hasEbook, hasAudiobook: row.hasAudiobook, hasPrint: row.hasPrint,
    printIsbns: ((row.submissionMetadata as { printIsbns?: PrintIsbns } | null)?.printIsbns) ?? undefined,
  };
  const out: NonNullable<Book["identifiers"]> = {};
  for (const f of ["ebook", "audiobook", "paperback", "hardcover"] as IdentifierFormat[]) out[f] = identifierFor(src, f);
  return out;
}

/** Turns the records of ONE title (see lib/book-groups.ts) into the single catalog book
 * the storefront shows: one product page with a price tab per format. Each format keeps
 * the price, identifier and record of its own edition; nothing is shared between formats. */
function toGroupedCatalogBook(rows: RealBookRow[]): Book {
  const main = toCatalogBook(rows[0]);
  if (rows.length === 1) return { ...main, identifiers: identifiersOf(rows[0]) };

  const formats = ["ebook", "audiobook", "paperback", "hardcover"] as const;
  const formatBookIds: NonNullable<Book["formatBookIds"]> = {};
  const identifiers: NonNullable<Book["identifiers"]> = {};
  const available = { ebook: false, paperback: false, hardcover: false, audiobook: false };
  const prices = { ...main.formats };
  let manuscriptUrl: string | undefined;
  let audiobookUrl: string | undefined;
  let printPages: number | undefined;
  let printDimensions: string | undefined;
  let ratingSum = 0;
  let ratingCount = 0;
  let reviewCount = 0;

  for (const r of rows) {
    const one = toCatalogBook(r);
    const ids = identifiersOf(r);
    for (const f of formats) {
      if (!one.formatAvailable?.[f] || formatBookIds[f]) continue;
      formatBookIds[f] = r.id;
      available[f] = true;
      identifiers[f] = ids[f];
      if (f === "ebook") prices.ebook = one.formats.ebook;
      if (f === "audiobook") prices.audiobook = one.formats.audiobook;
      if (f === "paperback") prices.paperback = one.formats.paperback;
      if (f === "hardcover") prices.print = one.formats.print;
    }
    if (one.formatAvailable?.ebook && !manuscriptUrl) manuscriptUrl = one.manuscriptUrl;
    if (one.formatAvailable?.audiobook && !audiobookUrl) audiobookUrl = one.audiobookUrl;
    if ((one.formatAvailable?.paperback || one.formatAvailable?.hardcover) && printPages === undefined) {
      printPages = one.pages;
      printDimensions = one.dimensions;
    }
    ratingSum += r.ratings.reduce((s, x) => s + x.stars, 0);
    ratingCount += r.ratings.length;
    reviewCount += r.reviews.length;
  }

  const headline = (["ebook", "audiobook", "paperback", "hardcover"] as const).find((f) => available[f]);
  const price = headline === "ebook" ? prices.ebook : headline === "audiobook" ? prices.audiobook : headline === "paperback" ? prices.paperback : headline === "hardcover" ? prices.print : main.price;
  const labels = [available.ebook && "eBook", (available.paperback || available.hardcover) && "Print", available.audiobook && "Audiobook"].filter(Boolean).join(", ");
  return {
    ...main,
    price,
    formats: prices,
    formatAvailable: available,
    formatBookIds,
    identifiers,
    manuscriptUrl,
    audiobookUrl,
    isbn: (available.ebook ? identifiers.ebook?.value : available.audiobook ? identifiers.audiobook?.value : null) ?? main.isbn,
    printPages,
    printDimensions,
    format: labels || main.format,
    rating: (ratingCount > 0 ? ratingSum / ratingCount : 0).toFixed(1),
    reviews: reviewCount,
    // Page count / size / file size describe the digital edition when there is one.
    ...(rows.some((r) => r.hasEbook) ? {} : { pages: printPages ?? main.pages, dimensions: printDimensions ?? main.dimensions }),
  };
}

const BOOK_INCLUDE = {
  author: { include: { user: true } },
  categories: { include: { category: true } },
  genres: { include: { genre: true } },
  files: true,
  reviews: true,
  ratings: true,
} as const;

/** Visitor-specific countries (account country + request geo), as returned
 * by lib/visitor-country.ts getVisitorCountries(). Omit it for the
 * non-request-scoped path (sitemaps, jobs): every country-restricted book is
 * then still returned, since there is no visitor to hide it from. */
export type VisitorCountries = readonly (string | null | undefined)[];

/** All real, published books, in catalog shape — empty array if the
 * database is unreachable, so the storefront degrades to the demo
 * catalog rather than erroring. Books an admin/old data withheld from the
 * store (submissionMetadata.sellOnStore === false) are never returned, and
 * when `visitorCountries` is given, books restricted in any of those
 * countries are hidden too. */
export async function getRealPublishedBooks(visitorCountries?: VisitorCountries): Promise<Book[]> {
  try {
    const rows = await prisma.book.findMany({
      where: { status: "PUBLISHED" },
      include: BOOK_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    if (!Array.isArray(rows)) return [];
    // One entry per book: the editions of a title (eBook / audiobook / print records) become
    // one catalog book with a price tab per format.
    const sellable = rows.filter((r) => !isSellOnStoreDisabled(r.submissionMetadata));
    return groupEditions(sellable)
      .map((g) => toGroupedCatalogBook(g))
      .filter((b) => isBookVisibleToVisitor(b, visitorCountries ?? []));
  } catch {
    return [];
  }
}

/** Resolves a specific list of book ids for the cart/checkout — checks
 * real database books first, then falls back to the static demo catalog
 * for any ids not found there (this is how a cart holding both a real
 * submitted book and a demo book resolves correctly). Only PUBLISHED,
 * on-sale books resolve. With `visitorCountries`, books restricted for
 * the visitor are still returned but flagged `restricted: true` so the
 * cart/checkout can show the message and block payment. */
export async function getBooksByIds(ids: string[], visitorCountries?: VisitorCountries): Promise<Book[]> {
  if (ids.length === 0) return [];
  try {
    const rows = await prisma.book.findMany({
      where: { id: { in: ids }, status: "PUBLISHED" },
      include: BOOK_INCLUDE,
    });
    const found = Array.isArray(rows)
      ? rows
          .filter((r) => !isSellOnStoreDisabled(r.submissionMetadata))
          .map((r) => {
            const b = toCatalogBook(r);
            return visitorCountries ? { ...b, restricted: isRestrictedForCountries(b.restrictedCountries, visitorCountries) } : b;
          })
      : [];
    const foundIds = new Set(found.map((b) => b.id));
    const demoFallback = BOOKS.filter((b) => ids.includes(b.id) && !foundIds.has(b.id));
    return [...found, ...demoFallback];
  } catch {
    return BOOKS.filter((b) => ids.includes(b.id));
  }
}

/** A single real book by id, in catalog shape — null if not found (or
 * not published / withheld from the store) or the database is
 * unreachable. Restriction is NOT applied here: the caller decides what a
 * restricted visitor sees (see app/[slug]/page.tsx). */
export async function getRealPublishedBookById(id: string): Promise<Book | null> {
  try {
    const row = await prisma.book.findUnique({ where: { id }, include: BOOK_INCLUDE });
    if (!row || row.status !== "PUBLISHED" || isSellOnStoreDisabled(row.submissionMetadata)) return null;
    return await withSiblingEditions(row);
  } catch {
    return null;
  }
}

export async function getRealPublishedBookBySlug(slug: string): Promise<Book | null> {
  try {
    const row = await prisma.book.findUnique({ where: { slug }, include: BOOK_INCLUDE });
    if (!row || row.status !== "PUBLISHED" || isSellOnStoreDisabled(row.submissionMetadata)) return null;
    return await withSiblingEditions(row);
  } catch {
    return null;
  }
}

/** The catalog book for a record, joined with the other published editions of the same
 * title by the same author (one product page, a price tab per format). */
async function withSiblingEditions(row: RealBookRow & { status?: string }): Promise<Book> {
  const siblings = await prisma.book.findMany({
    where: { authorId: row.authorId, status: "PUBLISHED", deletedByAuthorAt: null, title: { equals: row.title, mode: "insensitive" } },
    include: BOOK_INCLUDE,
  });
  const usable = (Array.isArray(siblings) ? siblings : []).filter((r) => !isSellOnStoreDisabled(r.submissionMetadata));
  const group = groupEditions(usable).find((g) => g.some((r) => r.id === row.id));
  return toGroupedCatalogBook(group ?? [row]);
}

/** Live number of PUBLISHED, visible books per Category series, straight
 * from the database (a light select, no covers/files/reviews). Applies
 * exactly the filters getRealPublishedBooks applies — PUBLISHED, not
 * withheld from the store (sellOnStore === false) and not restricted for the
 * visitor — and attributes older books with no Book.category through their
 * legacy Genre name (see lib/category-counts.ts), so the number on a card
 * equals what the `?series=` filter lists. Zeros if the database is
 * unreachable. */
export async function getPublishedCategoryCounts(visitorCountries?: VisitorCountries): Promise<Record<BookCategory, number>> {
  try {
    const rows = await prisma.book.findMany({
      where: { status: "PUBLISHED" },
      select: {
        category: true,
        subcategory: true,
        restrictedCountries: true,
        submissionMetadata: true,
        genres: { select: { genre: { select: { name: true } } } },
      },
    });
    if (!Array.isArray(rows)) return countBooksByCategory([]);
    const attributable: CategoryAttributionInput[] = rows
      .filter((r) => !isSellOnStoreDisabled(r.submissionMetadata))
      .filter((r) => isBookVisibleToVisitor({ restrictedCountries: effectiveRestrictedCountries(r) }, visitorCountries ?? []))
      .map((r) => ({
        category: r.category,
        subcategory: r.subcategory?.trim() || undefined,
        legacySubcategory: r.genres[0]?.genre.name,
      }));
    return countBooksByCategory(attributable);
  } catch {
    return countBooksByCategory([]);
  }
}

/** How many times each book has been bought, counting ONLY confirmed, paid
 * orders (pending, failed, cancelled and refunded orders never count). Used to
 * rank the home page Best Sellers. Empty if the database is unreachable. */
export async function getPaidSalesByBook(): Promise<Map<string, number>> {
  try {
    const rows = await prisma.saleLine.groupBy({
      by: ["bookId"],
      where: { order: { status: "PAID" } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.bookId, r._count._all]));
  } catch {
    return new Map();
  }
}
