import { prisma } from "@/lib/prisma";
import { bookAuthorDisplayName } from "@/lib/book-author-name";
import { descriptionToPlainText } from "@/lib/description-html";
import { mockupHash, type MockupSpec } from "@/lib/mockup/spec";
import { mockupWebp, renderPrintMockup } from "@/lib/mockup/render";

/**
 * Saves and finds the print mockups. The saved picture of each format is kept as an image (UploadedImage) and its id and a
 * short code of the settings it was made from are kept in the Setting table under "print_mockups:<book id>" (no schema
 * change). A picture is only made again when its code changes, so a new cover, page count or print setting redraws just
 * the format it affects.
 */

export type MockupFormat = "paperback" | "hardcover";
interface SavedMockup { id: string; hash: string }
type SavedMockups = Partial<Record<MockupFormat, SavedMockup>>;

const key = (bookId: string) => `print_mockups:${bookId}`;

export async function getSavedMockups(bookId: string): Promise<SavedMockups> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: key(bookId) } });
    return (row?.value as SavedMockups | null) ?? {};
  } catch {
    return {};
  }
}

/** The picture addresses for a product page: the record that sells each print format, and the saved picture of that format. */
export async function getPrintMockupUrls(ids: { paperback?: string; hardcover?: string }): Promise<{ paperback?: string; hardcover?: string }> {
  const out: { paperback?: string; hardcover?: string } = {};
  try {
    const bookIds = [...new Set([ids.paperback, ids.hardcover].filter((x): x is string => !!x))];
    if (bookIds.length === 0) return out;
    const rows = await prisma.setting.findMany({ where: { key: { in: bookIds.map(key) } } });
    const byBook = new Map(rows.map((r) => [r.key, (r.value as SavedMockups | null) ?? {}]));
    for (const f of ["paperback", "hardcover"] as const) {
      const bookId = ids[f];
      const saved = bookId ? byBook.get(key(bookId))?.[f] : undefined;
      if (saved?.id) out[f] = `/api/images/${saved.id}`;
    }
  } catch {
    // No picture is better than a broken page: the normal cover shows instead.
  }
  return out;
}

/** Reads the front cover picture. Only pictures stored on this site are read (never an address typed by someone). */
export async function loadCoverBuffer(url: string | null | undefined): Promise<Buffer | null> {
  const m = (url ?? "").match(/^\/api\/images\/([A-Za-z0-9_-]+)(?:\?.*)?$/);
  if (!m) return null;
  try {
    const row = await prisma.uploadedImage.findUnique({ where: { id: m[1] }, select: { data: true } });
    return row ? Buffer.from(row.data) : null;
  } catch {
    return null;
  }
}

interface BookForMockup {
  id: string;
  title: string;
  description: string | null;
  paperbackPrice: unknown;
  hardcoverPrice: unknown;
  coverImageUrl: string | null;
  hasPrint: boolean;
  submissionMetadata: unknown;
  author: { penName: string | null; user: { name: string } };
}

export function specFromBook(format: MockupFormat, book: BookForMockup): { spec: MockupSpec; coverUrl: string | null } | null {
  const meta = (book.submissionMetadata as Record<string, unknown> | null) ?? {};
  if (!book.hasPrint) return null;
  // A format is offered when it has a price (the same rule the store uses).
  if ((format === "paperback" ? book.paperbackPrice : book.hardcoverPrice) == null) return null;
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  const pages = Number(meta.pages);
  const printIsbns = (meta.printIsbns as { paperback?: string; hardcover?: string } | undefined) ?? {};
  const spec: MockupSpec = {
    format,
    title: book.title,
    author: bookAuthorDisplayName(book),
    description: descriptionToPlainText(book.description ?? "").slice(0, 700),
    isbn: s(meta.printIsbn).trim() || s(printIsbns[format]).trim() || null,
    trimCode: s(meta.trimSizeCode) || "0600X0900",
    pages: Number.isFinite(pages) && pages > 0 ? pages : 32,
    paperCode: s(meta.paperType) || "060UW444",
    finish: s(meta.coverFinish) || "M",
    linenColor: format === "hardcover" ? s(meta.linenColor) || "N" : "X",
    foilColor: format === "hardcover" ? s(meta.foilColor) || "X" : "X",
    foilTitle: format === "hardcover" ? s(meta.foilStampTitleText) : "",
    foilAuthor: format === "hardcover" ? s(meta.foilStampAuthorText) : "",
  };
  return { spec, coverUrl: s(meta.frontCoverImageUrl) || book.coverImageUrl };
}

export type EnsureResult = Record<MockupFormat, "made" | "kept" | "none" | "failed">;

/** Makes (or keeps, or removes) the saved mockup of each print format of a book. Never throws. */
export async function ensurePrintMockups(bookId: string): Promise<EnsureResult> {
  const result: EnsureResult = { paperback: "none", hardcover: "none" };
  try {
    const book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true, title: true, description: true, coverImageUrl: true, hasPrint: true, paperbackPrice: true, hardcoverPrice: true, submissionMetadata: true, author: { select: { penName: true, user: { select: { name: true } } } } },
    });
    if (!book) return result;
    const saved = await getSavedMockups(bookId);
    const next: SavedMockups = { ...saved };
    for (const format of ["paperback", "hardcover"] as const) {
      const built = specFromBook(format, book);
      if (!built) {
        if (saved[format]) {
          await prisma.uploadedImage.deleteMany({ where: { id: saved[format]!.id } }).catch(() => undefined);
          delete next[format];
        }
        continue;
      }
      const hash = mockupHash(built.spec, built.coverUrl ?? "");
      if (saved[format]?.hash === hash) { result[format] = "kept"; continue; }
      try {
        const png = await renderPrintMockup(built.spec, await loadCoverBuffer(built.coverUrl));
        const webp = await mockupWebp(png);
        const row = await prisma.uploadedImage.create({ data: { data: new Uint8Array(webp), mimeType: "image/webp" }, select: { id: true } });
        if (saved[format]) await prisma.uploadedImage.deleteMany({ where: { id: saved[format]!.id } }).catch(() => undefined);
        next[format] = { id: row.id, hash };
        result[format] = "made";
      } catch (e) {
        console.error(`[mockup] could not make the ${format} mockup for a book:`, e instanceof Error ? e.message : e);
        result[format] = "failed";
      }
    }
    const value = JSON.parse(JSON.stringify(next));
    await prisma.setting.upsert({ where: { key: key(bookId) }, update: { value }, create: { key: key(bookId), value } });
  } catch (e) {
    console.error("[mockup] ensurePrintMockups failed:", e instanceof Error ? e.message : e);
  }
  return result;
}
