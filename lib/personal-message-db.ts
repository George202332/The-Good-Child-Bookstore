import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type { MessageCheck } from "@/lib/personal-message";

/**
 * Server only: reading and writing Personal Messages. Plain SQL on purpose, so these few new columns never depend on a freshly
 * generated database client. Rows in "PersonalMessageRecord" are never deleted: every message and every decision stays.
 */
export interface MessageRow {
  recordId: string; orderId: string; saleLineId: string; bookId: string; bookTitle: string;
  text: string; style: string; status: string; reasons: string[]; decidedByName: string | null; decidedAt: Date | null; decisionNote: string | null; createdAt: Date;
}

const asReasons = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export async function saveOrderMessages(orderId: string, fee: number, entries: { saleLineId: string; bookId: string; text: string; style: string; check: MessageCheck }[]): Promise<void> {
  if (fee > 0) await prisma.$executeRaw`UPDATE "Order" SET "personalMessageFee" = ${fee} WHERE "id" = ${orderId}`;
  for (const e of entries) {
    const status = e.check.flagged ? "HELD" : "CLEAR";
    await insertRecord({ orderId, ...e, status, reasons: e.check.reasons });
    await prisma.$executeRaw`UPDATE "SaleLine" SET "personalMessage" = ${e.text}, "personalMessageStyle" = ${e.style}, "personalMessageStatus" = ${status} WHERE "id" = ${e.saleLineId}`;
  }
}

async function insertRecord(r: { orderId: string; saleLineId: string; bookId: string; text: string; style: string; status: string; reasons: string[] }): Promise<void> {
  const id = randomUUID();
  const history = JSON.stringify([{ at: new Date().toISOString(), by: "automatic check", action: r.status === "HELD" ? "held" : "passed", note: r.reasons.join("; ") }]);
  await prisma.$executeRaw`INSERT INTO "PersonalMessageRecord" ("id","orderId","saleLineId","bookId","text","style","status","flagReasons","history","updatedAt")
    VALUES (${id}, ${r.orderId}, ${r.saleLineId}, ${r.bookId}, ${r.text}, ${r.style}, ${r.status}, ${JSON.stringify(r.reasons)}::jsonb, ${history}::jsonb, NOW())`;
}

/** The current message on each line of an order (the line's own columns), for the confirmation page, receipt and print job. */
export async function messagesForOrder(orderId: string): Promise<{ saleLineId: string; bookId: string; bookTitle: string; text: string; style: string; status: string }[]> {
  try {
    const rows = await prisma.$queryRaw<{ id: string; bookId: string; title: string; personalMessage: string; personalMessageStyle: string | null; personalMessageStatus: string | null }[]>`
      SELECT sl."id", sl."bookId", b."title", sl."personalMessage", sl."personalMessageStyle", sl."personalMessageStatus"
      FROM "SaleLine" sl JOIN "Book" b ON b."id" = sl."bookId" WHERE sl."orderId" = ${orderId} AND sl."personalMessage" IS NOT NULL`;
    return rows.map((r) => ({ saleLineId: r.id, bookId: r.bookId, bookTitle: r.title, text: r.personalMessage, style: r.personalMessageStyle ?? "classic", status: r.personalMessageStatus ?? "CLEAR" }));
  } catch {
    return []; // the database is a step behind the code: show nothing rather than break the page
  }
}

export async function orderMessageFee(orderId: string): Promise<number> {
  try {
    const r = await prisma.$queryRaw<{ f: unknown }[]>`SELECT "personalMessageFee" AS f FROM "Order" WHERE "id" = ${orderId}`;
    return r[0]?.f ? Number(r[0].f) : 0;
  } catch { return 0; }
}

/** True while any message on the order still needs a decision (held or rejected): the print job must wait. */
export async function orderHasUnapprovedMessage(orderId: string): Promise<boolean> {
  try {
    const r = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "SaleLine" WHERE "orderId" = ${orderId} AND "personalMessageStatus" IN ('HELD','REJECTED')`;
    return Number(r[0]?.n ?? 0) > 0;
  } catch { return false; }
}

export async function heldCount(): Promise<number> {
  try {
    const r = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "PersonalMessageRecord" r JOIN "SaleLine" sl ON sl."id" = r."saleLineId" WHERE r."status" = 'HELD' AND sl."personalMessageStatus" = 'HELD'`;
    return Number(r[0]?.n ?? 0);
  } catch { return 0; }
}

export async function listRecords(filter: "HELD" | "ALL", limit = 200): Promise<MessageRow[]> {
  const rows = await prisma.$queryRaw<{ id: string; orderId: string; saleLineId: string; bookId: string; title: string; text: string; style: string; status: string; flagReasons: unknown; decidedByName: string | null; decidedAt: Date | null; decisionNote: string | null; createdAt: Date }[]>`
    SELECT r."id", r."orderId", r."saleLineId", r."bookId", b."title", r."text", r."style", r."status", r."flagReasons", r."decidedByName", r."decidedAt", r."decisionNote", r."createdAt"
    FROM "PersonalMessageRecord" r JOIN "Book" b ON b."id" = r."bookId"
    WHERE (${filter} = 'ALL' OR r."status" = 'HELD')
    ORDER BY r."createdAt" DESC LIMIT ${limit}`;
  return rows.map((r) => ({ recordId: r.id, orderId: r.orderId, saleLineId: r.saleLineId, bookId: r.bookId, bookTitle: r.title, text: r.text, style: r.style, status: r.status, reasons: asReasons(r.flagReasons), decidedByName: r.decidedByName, decidedAt: r.decidedAt, decisionNote: r.decisionNote, createdAt: r.createdAt }));
}

/** Records a reviewer's decision on a HELD message; returns the order id when it was applied. */
export async function decideRecord(recordId: string, action: "approve" | "reject", actor: { id: string; name: string }, note: string): Promise<{ ok: true; orderId: string; saleLineId: string } | { ok: false; error: string }> {
  const rows = await prisma.$queryRaw<{ orderId: string; saleLineId: string; status: string }[]>`SELECT "orderId","saleLineId","status" FROM "PersonalMessageRecord" WHERE "id" = ${recordId}`;
  const rec = rows[0];
  if (!rec) return { ok: false, error: "That message was not found." };
  if (rec.status !== "HELD") return { ok: false, error: "That message has already been decided." };
  const next = action === "approve" ? "APPROVED" : "REJECTED";
  const entry = JSON.stringify([{ at: new Date().toISOString(), by: actor.name, action: next.toLowerCase(), note }]);
  await prisma.$executeRaw`UPDATE "PersonalMessageRecord" SET "status" = ${next}, "decidedById" = ${actor.id}, "decidedByName" = ${actor.name}, "decidedAt" = NOW(), "decisionNote" = ${note || null}, "history" = COALESCE("history", '[]'::jsonb) || ${entry}::jsonb, "updatedAt" = NOW() WHERE "id" = ${recordId} AND "status" = 'HELD'`;
  await prisma.$executeRaw`UPDATE "SaleLine" SET "personalMessageStatus" = ${next} WHERE "id" = ${rec.saleLineId} AND "personalMessageStatus" = 'HELD'`;
  return { ok: true, orderId: rec.orderId, saleLineId: rec.saleLineId };
}

/** The buyer wrote a new message after a rejection: a NEW record is kept (the old one stays), and the line carries the new text. */
export async function replaceMessage(orderId: string, saleLineId: string, bookId: string, text: string, style: string, check: MessageCheck): Promise<void> {
  const status = check.flagged ? "HELD" : "CLEAR";
  await insertRecord({ orderId, saleLineId, bookId, text, style, status, reasons: check.reasons });
  await prisma.$executeRaw`UPDATE "SaleLine" SET "personalMessage" = ${text}, "personalMessageStyle" = ${style}, "personalMessageStatus" = ${status} WHERE "id" = ${saleLineId} AND "orderId" = ${orderId}`;
}

export async function lineMessageStatus(orderId: string, saleLineId: string): Promise<{ status: string | null; bookId: string } | null> {
  const r = await prisma.$queryRaw<{ s: string | null; b: string }[]>`SELECT "personalMessageStatus" AS s, "bookId" AS b FROM "SaleLine" WHERE "id" = ${saleLineId} AND "orderId" = ${orderId}`;
  return r[0] ? { status: r[0].s, bookId: r[0].b } : null;
}

export async function markInteriorBuilt(saleLineId: string): Promise<void> {
  await prisma.$executeRaw`UPDATE "SaleLine" SET "personalInteriorBuiltAt" = NOW() WHERE "id" = ${saleLineId}`;
}
