import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Serves a purchased book's file — checks the signed-in user actually
 * has a PAID order containing this book before redirecting to the
 * underlying manuscript file. The manuscript's own /api/files/[id]
 * route has no purchase check (it's also used for editorial review),
 * so this is the real gate for "download something I bought."
 */
export async function GET(request: Request, { params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const { origin } = new URL(request.url);
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", origin), { status: 302 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { readerProfile: true },
  });
  if (!user?.readerProfile) return new NextResponse("Not found", { status: 404 });

  const ownsBook = await prisma.saleLine.findFirst({
    where: { bookId, order: { readerId: user.readerProfile.id, status: "PAID" } },
  });
  if (!ownsBook) return new NextResponse("You haven't purchased this book.", { status: 403 });

  const file = await prisma.bookFile.findFirst({ where: { bookId, kind: "MANUSCRIPT" } });
  if (!file) return new NextResponse("No downloadable file is available for this book yet.", { status: 404 });

  return NextResponse.redirect(new URL(file.url, origin), { status: 302 });
}
