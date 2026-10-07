import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookAuthorDisplayName } from "@/lib/book-author-name";

/**
 * Serves a purchased book's file — checks the signed-in user actually
 * has a PAID order containing this book before serving the underlying
 * manuscript file. The manuscript's own /api/files/[id] route has no
 * purchase check (it's also used for editorial review), so this is the
 * real gate for "download something I bought."
 *
 * ?format=epub generates a real EPUB from the manuscript's actual text
 * (see lib/epub-generator.ts) — offered alongside PDF, per explicit
 * instruction that a reader should be able to get more than one
 * format. Genuine MOBI conversion isn't offered — it needs real
 * infrastructure this platform doesn't have, and faking it would be
 * worse than not offering it.
 *
 * ?format=audiobook serves the book's AUDIOBOOK file, and only to an
 * account that owns a PAID sale line in the 'audiobook' format for that
 * book (add &inline=1 to play it in the browser instead of downloading).
 * The manuscript (PDF/ePub) is served only to owners of an 'ebook' line —
 * or of an older line with no format recorded, so purchases made before
 * formats were tracked keep working. A print or audiobook purchase alone
 * does not unlock the manuscript.
 *
 * Otherwise, for a PDF manuscript (a native PDF upload, or a DOCX
 * converted to PDF at upload time — see lib/docx-to-pdf.ts), the
 * book's cover image is merged in as page 1 using pdf-lib, so the
 * downloaded file actually opens on the cover.
 */
export async function GET(request: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const { origin, searchParams } = new URL(request.url);
  const format = searchParams.get("format");
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", origin), { status: 302 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { readerProfile: true },
  });
  if (!user?.readerProfile) return new NextResponse("Not found", { status: 404 });

  const wantsAudiobook = format === "audiobook";
  const ownsBook = await prisma.saleLine.findFirst({
    where: {
      bookId,
      order: { readerId: user.readerProfile.id, status: "PAID" },
      ...(wantsAudiobook ? { format: "audiobook" } : { OR: [{ format: "ebook" }, { format: null }] }),
    },
  });
  if (!ownsBook) {
    return new NextResponse(
      wantsAudiobook ? "You haven't purchased the audiobook of this book." : "You haven't purchased this book.",
      { status: 403 },
    );
  }

  const book = await prisma.book.findUnique({ where: { id: bookId }, include: { files: true, author: { include: { user: true } } } });

  if (wantsAudiobook) {
    const audioFile = book?.files.find((f: { kind: string }) => f.kind === "AUDIOBOOK");
    if (!audioFile) return new NextResponse("No audiobook file is available for this book yet.", { status: 404 });
    const audioId = audioFile.url.startsWith("/api/files/") ? audioFile.url.split("/").pop() : undefined;
    const audio = audioId ? await prisma.uploadedFile.findUnique({ where: { id: audioId } }) : null;
    if (!audio) return NextResponse.redirect(new URL(audioFile.url, origin), { status: 302 });
    const disposition = searchParams.get("inline") === "1" ? "inline" : "attachment";
    return new NextResponse(new Uint8Array(audio.data), {
      headers: {
        "Content-Type": audio.mimeType,
        "Content-Length": String(audio.data.length),
        "Content-Disposition": `${disposition}; filename="${audio.originalName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const file = book?.files.find((f: { kind: string }) => f.kind === "MANUSCRIPT");
  if (!file) return new NextResponse("No downloadable file is available for this book yet.", { status: 404 });

  const fileId = file.url.split("/").pop();
  const uploadedFile = fileId ? await prisma.uploadedFile.findUnique({ where: { id: fileId } }) : null;

  if (format === "epub" && uploadedFile?.mimeType === "application/pdf") {
    try {
      const { extractPdfPages, generateEpub } = await import("@/lib/epub-generator");
      const pages = await extractPdfPages(new Uint8Array(uploadedFile.data));
      const authorName = book ? bookAuthorDisplayName(book) : "";
      const epubBytes = await generateEpub(pages, book?.title ?? "book", authorName);
      return new NextResponse(Buffer.from(epubBytes), {
        headers: {
          "Content-Type": "application/epub+zip",
          "Content-Disposition": `attachment; filename="${(book?.title || "book").replace(/[^a-z0-9]+/gi, "-")}.epub"`,
        },
      });
    } catch {
      return new NextResponse("EPUB generation failed for this title.", { status: 500 });
    }
  }

  if (uploadedFile?.mimeType === "application/pdf" && book?.coverImageUrl) {
    try {
      const coverImageId = book.coverImageUrl.split("/").pop();
      const coverImage = coverImageId ? await prisma.uploadedImage.findUnique({ where: { id: coverImageId } }) : null;
      if (coverImage) {
        const { PDFDocument } = await import("pdf-lib");
        const manuscriptDoc = await PDFDocument.load(uploadedFile.data);
        const finalDoc = await PDFDocument.create();

        const coverPage = finalDoc.addPage([612, 792]);
        const embeddedCover = coverImage.mimeType === "image/png"
          ? await finalDoc.embedPng(coverImage.data)
          : await finalDoc.embedJpg(coverImage.data);
        const scale = Math.min(612 / embeddedCover.width, 792 / embeddedCover.height);
        const w = embeddedCover.width * scale;
        const h = embeddedCover.height * scale;
        coverPage.drawImage(embeddedCover, { x: (612 - w) / 2, y: (792 - h) / 2, width: w, height: h });

        const manuscriptPages = await finalDoc.copyPages(manuscriptDoc, manuscriptDoc.getPageIndices());
        for (const p of manuscriptPages) finalDoc.addPage(p);

        const merged = await finalDoc.save();
        return new NextResponse(Buffer.from(merged), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${(book.title || "book").replace(/[^a-z0-9]+/gi, "-")}.pdf"`,
          },
        });
      }
    } catch {
      // If merging fails for any reason, fall through to serving the
      // manuscript as-is rather than blocking the download entirely.
    }
  }

  return NextResponse.redirect(new URL(file.url, origin), { status: 302 });
}
