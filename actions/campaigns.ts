"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Campaigns — a named grouping of referral links so an affiliate can
 * track aggregate performance across a marketing push (e.g. "Back to
 * school 2026") spanning several promoted books, instead of only
 * per-link stats (see /account/referrals for individual links).
 */

async function getAffiliateProfileId(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.role !== "AFFILIATE") return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { affiliateProfile: true } });
  return user?.affiliateProfile?.id ?? null;
}

export interface CampaignRow {
  id: string;
  name: string;
  linkCount: number;
  clicks: number;
  conversions: number;
  createdAt: Date;
}

export async function listMyCampaigns(): Promise<CampaignRow[]> {
  const affiliateId = await getAffiliateProfileId();
  if (!affiliateId) return [];

  try {
    const campaigns = await prisma.campaign.findMany({
      where: { affiliateId },
      include: { links: { include: { clicks: true, saleLines: true } } },
      orderBy: { createdAt: "desc" },
    });
    return campaigns.map((c: { id: string; name: string; createdAt: Date; links: { clicks: unknown[]; saleLines: unknown[] }[] }) => ({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      linkCount: c.links.length,
      clicks: c.links.reduce((sum, l) => sum + l.clicks.length, 0),
      conversions: c.links.reduce((sum, l) => sum + l.saleLines.length, 0),
    }));
  } catch {
    return [];
  }
}

export async function createCampaign(name: string): Promise<{ ok: boolean; error?: string }> {
  const affiliateId = await getAffiliateProfileId();
  if (!affiliateId) return { ok: false, error: "Only affiliate accounts can create campaigns." };
  if (!name.trim()) return { ok: false, error: "Campaign name is required." };

  await prisma.campaign.create({ data: { affiliateId, name: name.trim() } });
  revalidatePath("/account/campaigns");
  return { ok: true };
}

export async function deleteCampaign(campaignId: string): Promise<{ ok: boolean; error?: string }> {
  const affiliateId = await getAffiliateProfileId();
  if (!affiliateId) return { ok: false, error: "Not authorized." };

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.affiliateId !== affiliateId) return { ok: false, error: "Not found." };

  await prisma.campaign.delete({ where: { id: campaignId } });
  revalidatePath("/account/campaigns");
  return { ok: true };
}

export interface CampaignOption {
  id: string;
  name: string;
}

/** For the referral-link generator's "assign to a campaign" dropdown. */
export async function listMyCampaignOptions(): Promise<CampaignOption[]> {
  const affiliateId = await getAffiliateProfileId();
  if (!affiliateId) return [];
  const campaigns = await prisma.campaign.findMany({ where: { affiliateId }, orderBy: { name: "asc" } });
  return campaigns.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }));
}
