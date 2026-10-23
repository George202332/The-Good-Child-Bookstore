import { NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { parseRequestedWidth } from "@/lib/image-url";

/** Serves an uploaded, WebP-converted image back out of the database —
 * see actions/images.ts for how it gets stored. Cached aggressively since
 * uploaded images never change in place (a re-upload creates a new row
 * with a new id/URL).
 *
 * With ?w=<width> (one of the widths in lib/image-url.ts) a smaller copy is
 * returned, so a book card or banner downloads only as many pixels as it
 * shows. Each size is made once and then kept by the CDN like the original. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const width = parseRequestedWidth(new URL(request.url).searchParams.get("w"));

  const image = await prisma.uploadedImage.findUnique({ where: { id } });
  if (!image) {
    return new NextResponse("Not found", { status: 404 });
  }

  const headers = {
    "Content-Type": image.mimeType,
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  if (width && image.mimeType !== "image/svg+xml") {
    try {
      const resized = await sharp(Buffer.from(image.data))
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: width <= 24 ? 50 : 80 })
        .toBuffer();
      return new NextResponse(new Uint8Array(resized), { headers: { ...headers, "Content-Type": "image/webp" } });
    } catch {
      // Fall through to the original rather than showing a broken picture.
    }
  }

  return new NextResponse(new Uint8Array(image.data), { headers });
}
