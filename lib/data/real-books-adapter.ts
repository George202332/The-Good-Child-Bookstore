import { prisma } from "@/lib/prisma";
import { hashStr } from "@/lib/hash";
import { BOOKS, PALETTES, type Book, type MotifKind } from "@/lib/data/catalog";

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

function categoryIdFromLabel(label: string | null | undefined): string {
  const lower = (label ?? "").toLowerCase();
  if (lower.includes("bedtime")) return "bedtime";
  if (lower.includes("early")) return "early";
  if (lower.includes("middle")) return "middle";
  if (lower.includes("activity")) return "activity";
  return "picture";
}

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
  files: { kind: string; url: string }[];
  ageGroup: string | null;
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
}

function toCatalogBook(row: RealBookRow): Book {
  const seed = hashStr(row.id);
  const price = Number(row.price);
  const avgRating = row.ratings.length > 0 ? row.ratings.reduce((s, r) => s + r.stars, 0) / row.ratings.length : 0;
  const meta = (row.submissionMetadata as { affiliateEnabled?: boolean; includeInPromotions?: boolean; marketplaceLinks?: Record<string, string> } | null) ?? null;

  return {
    id: row.id,
    title: row.title,
    author: row.author.user.name,
    authorId: row.authorId,
    motif: MOTIF_KINDS[seed % MOTIF_KINDS.length],
    palette: PALETTES[seed % PALETTES.length],
    category: categoryIdFromLabel(row.categories[0]?.category.name),
    genre: row.genres[0]?.genre.name ?? "Adventure",
    age: ageFromAgeGroup(row.ageGroup),
    price,
    formats: {
      ebook: row.ebookPrice ? Number(row.ebookPrice) : price,
      print: row.hardcoverPrice ? Number(row.hardcoverPrice) : price,
      paperback: row.paperbackPrice ? Number(row.paperbackPrice) : price,
      audiobook: row.audiobookPrice ? Number(row.audiobookPrice) : price,
    },
    formatAvailable: {
      ebook: row.hasEbook,
      paperback: row.hasPrint && row.paperbackPrice != null,
      hardcover: row.hasPrint && row.hardcoverPrice != null,
      audiobook: row.hasAudiobook,
    },
    manuscriptUrl: row.files.find((f) => f.kind === "MANUSCRIPT")?.url,
    isbn: row.isbn ?? "",
    pubDate: row.createdAt.toISOString().slice(0, 10),
    sizeMB: (2 + (seed % 8)).toFixed(1),
    rating: avgRating.toFixed(1),
    reviews: row.reviews.length,
    pages: 24 + (seed % 40),
    format: [row.hasEbook && "eBook", row.hasPrint && "Print", row.hasAudiobook && "Audiobook"].filter(Boolean).join(", ") || "eBook",
    blurb: row.description ?? "",
    featured: meta?.includeInPromotions ?? false,
    affiliateEnabled: meta?.affiliateEnabled ?? false,
    coverImage: row.coverImageUrl ?? undefined,
    marketplaceLinks: meta?.marketplaceLinks && Object.keys(meta.marketplaceLinks).length > 0 ? meta.marketplaceLinks : undefined,
  };
}

/** All real, published books, in catalog shape — empty array if the
 * database is unreachable, so the storefront degrades to the demo
 * catalog rather than erroring. */
export async function getRealPublishedBooks(): Promise<Book[]> {
  try {
    const rows = await prisma.book.findMany({
      where: { status: "PUBLISHED" },
      include: {
        author: { include: { user: true } },
        categories: { include: { category: true } },
        genres: { include: { genre: true } },
        files: true,
        reviews: true,
        ratings: true,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!Array.isArray(rows)) return [];
    return rows.map((r: RealBookRow) => toCatalogBook(r));
  } catch {
    return [];
  }
}

/** Resolves a specific list of book ids for the cart/checkout — checks
 * real database books first, then falls back to the static demo catalog
 * for any ids not found there (this is how a cart holding both a real
 * submitted book and a demo book resolves correctly). Previously the
 * cart and checkout pages only ever checked the static catalog, so a
 * real book silently vanished from the cart at checkout. */
export async function getBooksByIds(ids: string[]): Promise<Book[]> {
  if (ids.length === 0) return [];
  try {
    const rows = await prisma.book.findMany({
      where: { id: { in: ids } },
      include: {
        author: { include: { user: true } },
        categories: { include: { category: true } },
        genres: { include: { genre: true } },
        files: true,
        reviews: true,
        ratings: true,
      },
    });
    const found = Array.isArray(rows) ? rows.map((r: RealBookRow) => toCatalogBook(r)) : [];
    const foundIds = new Set(found.map((b) => b.id));
    const demoFallback = BOOKS.filter((b) => ids.includes(b.id) && !foundIds.has(b.id));
    return [...found, ...demoFallback];
  } catch {
    return BOOKS.filter((b) => ids.includes(b.id));
  }
}

/** A single real book by id, in catalog shape — null if not found (or
 * not published) or the database is unreachable. */
export async function getRealPublishedBookById(id: string): Promise<Book | null> {
  try {
    const row = await prisma.book.findUnique({
      where: { id },
      include: {
        author: { include: { user: true } },
        categories: { include: { category: true } },
        genres: { include: { genre: true } },
        files: true,
        reviews: true,
        ratings: true,
      },
    });
    if (!row || row.status !== "PUBLISHED") return null;
    return toCatalogBook(row as RealBookRow);
  } catch {
    return null;
  }
}
