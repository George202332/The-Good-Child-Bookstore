import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Serves an uploaded, WebP-converted image back out of the database —
 * see actions/images.ts for how it gets stored. Cached aggressively since
 * uploaded images never change in place (a re-upload creates a new row
 * with a new id/URL). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const image = await prisma.uploadedImage.findUnique({ where: { id } });
  if (!image) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
