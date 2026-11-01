import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inlineContentDisposition } from "@/lib/file-response";
import { verifySignedFile } from "@/lib/signed-file-url";
import { reportSystemError } from "@/lib/site-health/alert";

/**
 * The address Lulu downloads print files from. It needs no login, only a valid, unexpired signature that the
 * site itself made (see lib/signed-file-url.ts), so a file is reachable only through a link we handed out and
 * only until that link expires. Nothing here lists, guesses or caches files.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  if (!verifySignedFile(id, url.searchParams.get("exp"), url.searchParams.get("sig"))) {
    return new NextResponse("This link is not valid or has expired.", { status: 403 });
  }
  try {
    const file = await prisma.uploadedFile.findUnique({ where: { id } });
    if (!file) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.data.length),
        "Content-Disposition": inlineContentDisposition(file.originalName),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error(`[lulu-files] could not serve file ${id}: ${e instanceof Error ? e.message : "unknown error"}`);
    await reportSystemError("OTHER", e, {}).catch(() => {});
    return new NextResponse("The file could not be served right now.", { status: 500 });
  }
}
