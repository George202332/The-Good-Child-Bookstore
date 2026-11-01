import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authEither } from "@/lib/auth-either";
import { inlineContentDisposition } from "@/lib/file-response";
import { reportSystemError } from "@/lib/site-health/alert";

/** Whether the current session may fetch an audiobook file: editorial staff/admin,
 * the book's own author, or a buyer with a PAID 'audiobook' sale line. */
async function mayFetchAudiobook(bookId: string, authorUserId: string): Promise<boolean> {
  const session = await authEither();
  const userId = session?.user?.id;
  if (!userId) return false;
  // Editorial staff reviewing the submission, and admins.
  if (["EDITOR", "CHIEF_EDITOR", "ADMIN"].includes(String(session.user.role))) return true;
  if (userId === authorUserId) return true;
  const reader = await prisma.readerProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!reader) return false;
  const owned = await prisma.saleLine.findFirst({
    where: { bookId, format: "audiobook", order: { readerId: reader.id, status: "PAID" } },
    select: { id: true },
  });
  return !!owned;
}

/** Serves a generically-uploaded file (manuscript, sample pages) back
 * out of the database — see actions/files.ts. Audiobook files are the
 * exception: once an upload is attached to a book as its AUDIOBOOK file
 * it is a paid product, so it is only served to staff, the author, or a
 * buyer who owns the audiobook (buyers normally go through
 * /api/downloads/[bookId]?format=audiobook). Uploads not yet attached to
 * a book (e.g. mid-submission previews) are served as before. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const audiobookRef = await prisma.bookFile.findFirst({
      where: { kind: "AUDIOBOOK", url: { endsWith: `/${id}` } },
      select: { bookId: true, book: { select: { author: { select: { userId: true } } } } },
    });
    if (audiobookRef && !(await mayFetchAudiobook(audiobookRef.bookId, audiobookRef.book.author.userId))) {
      return new NextResponse("You haven't purchased this audiobook.", { status: 403 });
    }

    const file = await prisma.uploadedFile.findUnique({ where: { id } });
    if (!file) {
      return new NextResponse("Not found", { status: 404 });
    }

    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.data.length),
        // The name is encoded safely: a file name with an en dash, curly quotes or any non-Latin letter used to
        // make building this header throw, which answered 500 (see lib/file-response.ts).
        "Content-Disposition": inlineContentDisposition(file.originalName),
        "Cache-Control": audiobookRef ? "private, no-store" : "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    // Log the reason (never any secret) so the next failure is explained in the Vercel logs.
    console.error(`[files] could not serve file ${id}: ${e instanceof Error ? e.message : "unknown error"}`);
    await reportSystemError("OTHER", e, {}).catch(() => {});
    return new NextResponse("The file could not be served right now.", { status: 500 });
  }
}
