import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchLuluPrintJob } from "@/lib/payments/lulu";
import { applyLuluJob } from "@/lib/lulu-sync";

/**
 * Lulu calls this when a print job's status changes. The request body is NEVER trusted for
 * the status: it is only used to find which print job changed, and then we ask Lulu directly
 * (GET /print-jobs/{id}) for the real status. A forged request can therefore do nothing
 * except make us ask Lulu a question. Always answers 200 so Lulu does not keep retrying;
 * the rejection notice is sent once however many times Lulu repeats an event.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { data?: { id?: unknown }; id?: unknown } | null;
    const raw = body?.data?.id ?? body?.id;
    const jobId = typeof raw === "number" || typeof raw === "string" ? String(raw) : "";
    if (!jobId) return NextResponse.json({ ok: true });
    const order = await prisma.order.findFirst({ where: { printJobId: jobId }, select: { id: true } });
    if (!order) return NextResponse.json({ ok: true });
    const res = await fetchLuluPrintJob(jobId);
    if (res.ok) await applyLuluJob(order.id, res.json);
  } catch (e) {
    console.error("Lulu webhook failed", e);
  }
  return NextResponse.json({ ok: true });
}
