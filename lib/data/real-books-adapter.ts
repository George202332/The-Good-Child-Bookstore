import { prisma } from "@/lib/prisma";
import { hashStr } from "@/lib/hash";
import { BOOKS, PALETTES, type Book, type MotifKind } from "@/lib/data/catalog";
import { categoryOfSubcategory, type BookCategory } from "@/lib/taxonomy";
import { attributeCategory, countBooksByCategory, type CategoryAttributionInput } from "@/lib/category-counts";
import { genreLabelFromShelfId, shelfIdFromGenreLabel } from "@/lib/shelf-mapping";
import {
  effectiveRestrictedCountries,
  isBookVisibleToVisitor,
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
  const digits = (ageGroup ?? "").match(/[\d-]+/);
  return digits ? digits[0] : "3-5";
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
  const price = Number(row.price);
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
    publicationDate?: string;
    aiDeclaration?: string;
  } | null) ?? null;
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
    pubDate: meta?.publicationDate || row.createdAt.toISOString().slice(0, 10),
    sizeMB: (2 + (seed % 8)).toFixed(1),
    rating: avgRating.toFixed(1),
    reviews: row.reviews.length,
    // Real page count when the manuscript's was auto-detected (or the
    // author entered one) at submission — the seed-based placeholder
    // only covers older books submitted before this was captured.
    pages: meta?.pages ?? 24 + (seed % 40),
    language: row.language,
    dimensions: meta?.dimensions,
    publisher: meta?.publisher,
    aiDeclaration: meta?.aiDeclaration,
    fileSizeKB: meta?.fileSizeKB,
    format: [row.hasEbook && "eBook", row.hasPrint && "Print", row.hasAudiobook && "Audiobook"].filter(Boolean).join(", ") || "eBook",
    blurb: row.description ?? "",
    featured: meta?.includeInPromotions ?? false,
    affiliateEnabled: meta?.affiliateEnabled ?? false,
    coverImage: row.coverImageUrl ?? undefined,
    coverAltText: row.coverAltText ?? undefined,
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
    return rows
      .filter((r) => !isSellOnStoreDisabled(r.submissionMetadata))
      .map((r) => toCatalogBook(r))
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
    return toCatalogBook(row);
  } catch {
    return null;
  }
}

export async function getRealPublishedBookBySlug(slug: string): Promise<Book | null> {
  try {
    const row = await prisma.book.findUnique({ where: { slug }, include: BOOK_INCLUDE });
    if (!row || row.status !== "PUBLISHED" || isSellOnStoreDisabled(row.submissionMetadata)) return null;
    return toCatalogBook(row);
  } catch {
    return null;
  }
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
