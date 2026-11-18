import { prisma } from "@/lib/prisma";
import { snColumn, isbnColumn, printFieldsOf } from "@/lib/identifiers";

/** SERVER-ONLY: a book as it is referenced in a message: its title and its SN (or ISBN for print-only books). */
export interface BookRef { id: string; title: string; sn: string }

type BookRow = { id: string; title: string; isbn: string | null; hasEbook: boolean; hasPrint: boolean; hasAudiobook: boolean; submissionMetadata: unknown };

function refOf(b: BookRow): BookRef {
  const src = { isbn: b.isbn, hasEbook: b.hasEbook, hasAudiobook: b.hasAudiobook, hasPrint: b.hasPrint, ...printFieldsOf(b.submissionMetadata) };
  return { id: b.id, title: b.title, sn: snColumn(src) ?? isbnColumn(src) ?? b.isbn ?? "—" };
}

const SELECT = { id: true, title: true, isbn: true, hasEbook: true, hasPrint: true, hasAudiobook: true, submissionMetadata: true } as const;

/** The books an author owns (for the message form's selector). Nobody else's. */
export async function listBooksOfAuthor(userId: string): Promise<BookRef[]> {
  try {
    const rows = await prisma.book.findMany({ where: { author: { userId } }, select: SELECT, orderBy: { title: "asc" }, take: 500 });
    return (rows as BookRow[]).map(refOf);
  } catch {
    return [];
  }
}

/** The reference for one book, only if this author owns it. Null otherwise. */
export async function bookRefOwnedBy(userId: string, bookId: string): Promise<BookRef | null> {
  try {
    const b = await prisma.book.findFirst({ where: { id: bookId, author: { userId } }, select: SELECT });
    return b ? refOf(b as BookRow) : null;
  } catch {
    return null;
  }
}

/** The same reference with no owner check, for Lulu and order updates, where the book comes from the order itself. */
export function bookRefOf(b: BookRow): BookRef {
  return refOf(b);
}
