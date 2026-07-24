import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Serves a generically-uploaded file (manuscript, sample pages) back
 * out of the database — see actions/files.ts. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const file = await prisma.uploadedFile.findUnique({ where: { id } });
  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${file.originalName}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
