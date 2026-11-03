import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accountingViewer } from "@/lib/accounting/guard";

export const dynamic = "force-dynamic";

/** Serves an expense receipt. Only a signed-in Admin or Investor can open it (unlike uploaded book files, which anyone with the link can). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await accountingViewer())) return new NextResponse("Not allowed.", { status: 403 });
  const { id } = await params;
  const file = await prisma.accountingReceipt.findUnique({ where: { id } });
  if (!file) return new NextResponse("Not found.", { status: 404 });
  const safeName = file.originalName.replace(/[^\w.\- ]+/g, "_");
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
