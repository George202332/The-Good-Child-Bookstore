"use server";

import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can manage test data." };
  return { ok: true };
}

// Common disposable/test email domains and keywords — a real customer
// email is very unlikely to contain any of these.
const TEST_EMAIL_KEYWORDS = ["test", "demo", "example", "fake", "sample", "dummy"];
const TEST_EMAIL_DOMAINS = ["example.com", "test.com", "mailinator.com", "yopmail.com", "tempmail.com", "guerrillamail.com"];

// Paystack's documented test-mode card BINs — a transaction authorized
// against one of these could only ever have happened with a Paystack
// test secret key, never a real customer's real card.
const PAYSTACK_TEST_BINS = ["408408", "507850", "526613", "552565"];

function emailLooksLikeTest(email: string): boolean {
  const lower = email.toLowerCase();
  if (TEST_EMAIL_DOMAINS.some((d) => lower.endsWith(`@${d}`))) return true;
  const localPart = lower.split("@")[0] ?? "";
  return TEST_EMAIL_KEYWORDS.some((kw) => localPart.includes(kw));
}

export interface DetectedRecord {
  id: string;
  label: string;
  reasons: string[];
}

export interface TestDataReport {
  users: DetectedRecord[];
  books: DetectedRecord[];
  orders: DetectedRecord[];
  paymentLogs: DetectedRecord[];
  affiliateLinks: DetectedRecord[];
  saleLines: DetectedRecord[];
}

/**
 * Read-only scan — detects likely test data using real evidence and
 * explains why each record was flagged. Nothing here modifies the
 * database. Backend staff accounts (Admin/Editor/Accountant) are never
 * scanned or eligible, under any circumstance. An order/payment is
 * only ever flagged when it matches a real signal (a detected test
 * user, an existing manual flag, or a Paystack test-card BIN) — an
 * order with none of these is left alone, which is what keeps genuine
 * live Paystack transactions untouched.
 */
export async function generateTestDataReport(): Promise<TestDataReport | { error: string }> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const candidateUsers = await prisma.user.findMany({
    where: { role: { in: ["READER", "AUTHOR"] } },
    select: { id: true, email: true, name: true, role: true, isTestData: true },
  });

  const detectedUsers: DetectedRecord[] = [];
  const detectedUserIds = new Set<string>();
  for (const u of candidateUsers) {
    const reasons: string[] = [];
    if (u.isTestData) reasons.push("Already manually flagged as test data");
    if (emailLooksLikeTest(u.email)) reasons.push(`Email address "${u.email}" matches a known test/demo pattern`);
    if (reasons.length > 0) {
      detectedUsers.push({ id: u.id, label: `${u.name} (${u.email}) — ${u.role}`, reasons });
      detectedUserIds.add(u.id);
    }
  }

  const books = await prisma.book.findMany({
    select: { id: true, title: true, isTestData: true, author: { select: { userId: true } } },
  });
  const detectedBooks: DetectedRecord[] = [];
  for (const b of books) {
    const reasons: string[] = [];
    if (b.isTestData) reasons.push("Already manually flagged as test data");
    if (detectedUserIds.has(b.author.userId)) reasons.push("Submitted by a detected test author");
    if (reasons.length > 0) detectedBooks.push({ id: b.id, label: b.title, reasons });
  }

  const orders = await prisma.order.findMany({
    select: {
      id: true,
      totalAmount: true,
      isTestData: true,
      reader: { select: { userId: true } },
      paymentLogs: { select: { id: true, rawPayload: true } },
    },
  });
  const detectedOrders: DetectedRecord[] = [];
  const detectedPaymentLogs: DetectedRecord[] = [];
  for (const o of orders) {
    const reasons: string[] = [];
    if (o.isTestData) reasons.push("Already manually flagged as test data");
    if (detectedUserIds.has(o.reader.userId)) reasons.push("Placed by a detected test account");

    for (const log of o.paymentLogs) {
      const bin = extractBin(log.rawPayload);
      if (bin && PAYSTACK_TEST_BINS.includes(bin)) {
        const reason = `Paystack payment used test-card BIN ${bin}`;
        if (!reasons.includes(reason)) reasons.push(reason);
        detectedPaymentLogs.push({ id: log.id, label: `Payment log for order #${o.id.slice(0, 8).toUpperCase()}`, reasons: [reason] });
      }
    }

    if (reasons.length > 0) {
      detectedOrders.push({ id: o.id, label: `Order #${o.id.slice(0, 8).toUpperCase()} — $${Number(o.totalAmount).toFixed(2)}`, reasons });
    }
  }
  const detectedOrderIds = new Set(detectedOrders.map((o) => o.id));

  const saleLines = await prisma.saleLine.findMany({
    where: { orderId: { in: Array.from(detectedOrderIds) } },
    select: { id: true, orderId: true },
  });
  const detectedSaleLines: DetectedRecord[] = saleLines.map((s: { id: string; orderId: string }) => ({
    id: s.id,
    label: `Sale line on order #${s.orderId.slice(0, 8).toUpperCase()}`,
    reasons: ["Belongs to a detected test order"],
  }));

  const affiliateLinks = await prisma.affiliateLink.findMany({
    select: { id: true, code: true, affiliate: { select: { userId: true } } },
  });
  const detectedAffiliateLinks: DetectedRecord[] = [];
  for (const l of affiliateLinks) {
    if (detectedUserIds.has(l.affiliate.userId)) {
      detectedAffiliateLinks.push({ id: l.id, label: `Affiliate link ${l.code}`, reasons: ["Belongs to a detected test affiliate account"] });
    }
  }

  return {
    users: detectedUsers,
    books: detectedBooks,
    orders: detectedOrders,
    paymentLogs: detectedPaymentLogs,
    affiliateLinks: detectedAffiliateLinks,
    saleLines: detectedSaleLines,
  };
}

function extractBin(rawPayload: unknown): string | null {
  if (!rawPayload || typeof rawPayload !== "object") return null;
  const p = rawPayload as Record<string, unknown>;
  const data = (p.data && typeof p.data === "object" ? p.data : p) as Record<string, unknown>;
  const auth = data.authorization && typeof data.authorization === "object" ? (data.authorization as Record<string, unknown>) : null;
  const bin = auth?.bin;
  return typeof bin === "string" ? bin : null;
}
