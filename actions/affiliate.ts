"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Real affiliate link + click tracking, replacing the original's fully
 * simulated version (aff.promotedBookIds, affiliateBookStats() — all
 * hashStr-seeded fake numbers, the-good-child-bookstore_54_1.html
 * area around 6738-6800). An affiliate generates a link for a specific
 * book; visiting that book page with ?aff=<code> records a real
 * AffiliateClick and sets a 30-day cookie identifying the exact
 * (affiliateLink, book) pair, which placeOrder() (actions/orders.ts)
 * reads to decide whether that specific line in a later purchase should
 * get the affiliate revenue split and be linked back to this AffiliateLink.
 */

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export interface AffiliateLinkWithStats {
  id: string;
  code: string;
  bookId: string | null;
  bookTitle: string;
  bookCoverUrl: string | null;
  clicks: number;
  conversions: number;
  commissionEarned: number;
}

export async function getOrCreateAffiliateLink(bookId: string, campaignId?: string): Promise<{ ok: boolean; code?: string; error?: string }> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You need to be signed in." };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { affiliateProfile: true } });
    if (!user?.affiliateProfile) {
      return { ok: false, error: "Enable affiliate access from your dashboard first." };
    }

    const existing = await prisma.affiliateLink.findFirst({
      where: { affiliateId: user.affiliateProfile.id, bookId },
    });
    if (existing) {
      // If this link already exists but wasn't yet assigned to a campaign,
      // assigning one now is fine — a link belongs to at most one campaign.
      if (campaignId && !existing.campaignId) {
        await prisma.affiliateLink.update({ where: { id: existing.id }, data: { campaignId } });
      }
      return { ok: true, code: existing.code };
    }

    const link = await prisma.affiliateLink.create({
      data: { affiliateId: user.affiliateProfile.id, bookId, campaignId, code: generateCode() },
    });
    return { ok: true, code: link.code };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong generating that link." };
  }
}

/** Records a click for stats (Performance page's click counts) — the
 * actual commission-attribution cookie is now set directly in
 * middleware (proxy.ts), which is guaranteed to run on every request
 * before any page JavaScript loads, unlike this client-triggered action
 * which only fired once the page had mounted and its effect had run. */
export async function recordAffiliateClick(code: string): Promise<void> {
  const link = await prisma.affiliateLink.findUnique({ where: { code } });
  if (!link) return;

  await prisma.affiliateClick.create({ data: { affiliateLinkId: link.id } });
}

export async function listMyAffiliateLinks(): Promise<AffiliateLinkWithStats[]> {
  const session = await auth();
  if (!session?.user) return [];

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { affiliateProfile: true } });
    if (!user?.affiliateProfile) return [];

    const links = await prisma.affiliateLink.findMany({
      where: { affiliateId: user.affiliateProfile.id },
      include: { book: true, clicks: true, saleLines: true },
      orderBy: { createdAt: "desc" },
    });

    return links.map((l: { id: string; code: string; bookId: string | null; book: { title: string; coverImageUrl: string | null } | null; clicks: unknown[]; saleLines: { affiliateShare: unknown }[] }) => ({
      id: l.id,
      code: l.code,
      bookId: l.bookId,
      bookTitle: l.book?.title ?? "Unknown book",
      bookCoverUrl: l.book?.coverImageUrl ?? null,
      clicks: l.clicks.length,
      conversions: l.saleLines.length,
      commissionEarned: l.saleLines.reduce((sum: number, s) => sum + Number(s.affiliateShare), 0),
    }));
  } catch {
    return [];
  }
}
