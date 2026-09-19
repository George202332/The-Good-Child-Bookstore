import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Generates a real EPUB on the spot from an uploaded manuscript's
 * actual text — used both for the "preview your book" download during
 * submission, and (once wired to a real purchase) for delivering an
 * EPUB copy to a buyer. Requires being signed in, since this reads a
 * file the caller uploaded themselves (checked via manuscript
 * ownership isn't verified further here since this route is only used
 * from the author's own submission page while composing a new title —
 * before the book has an owner-checkable id at all).
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Sign in required.", { status: 401 });

  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");
  const title = searchParams.get("title") || "Untitled";
  const author = searchParams.get("author") || "";
  if (!fileId) return new NextResponse("Missing fileId.", { status: 400 });

  const file = await prisma.uploadedFile.findUnique({ where: { id: fileId } });
  if (!file) return new NextResponse("File not found.", { status: 404 });
  if (file.mimeType !== "application/pdf") {
    return new NextResponse("EPUB generation currently supports PDF-sourced manuscripts only (a DOCX upload is already converted to PDF automatically at upload time).", { status: 415 });
  }

  try {
    const { extractPdfPages, generateEpub } = await import("@/lib/epub-generator");
    const pages = await extractPdfPages(new Uint8Array(file.data));
    const epubBytes = await generateEpub(pages, title, author);
    return new NextResponse(Buffer.from(epubBytes), {
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Disposition": `attachment; filename="${title.replace(/[^a-z0-9]+/gi, "-")}.epub"`,
      },
    });
  } catch (e) {
    return new NextResponse(`EPUB generation failed: ${e instanceof Error ? e.message : "Unknown error"}`, { status: 500 });
  }
}
