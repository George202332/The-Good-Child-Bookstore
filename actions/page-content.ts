"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { DEFAULT_PAGES_CONTENT, type PagesContent } from "@/lib/page-content";

/**
 * Editable intro content for Home, Bookshelf, Authorship, Affiliate,
 * Blog, and Contact — "I should control every content and text... in
 * the home, bookshelf, authorship, affiliate, blog and contact us
 * pages" from the explicit request. Merged into /admin/site-settings
 * rather than its own page (previously /admin/homepage, home-only).
 */

const PAGES_CONTENT_KEY = "pages_content";

export async function getPagesContent(): Promise<PagesContent> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: PAGES_CONTENT_KEY } });
    if (setting?.value && typeof setting.value === "object") {
      const stored = setting.value as Partial<PagesContent>;
      return {
        home: { ...DEFAULT_PAGES_CONTENT.home, ...(stored.home ?? {}) },
        shop: { ...DEFAULT_PAGES_CONTENT.shop, ...(stored.shop ?? {}) },
        authorship: { ...DEFAULT_PAGES_CONTENT.authorship, ...(stored.authorship ?? {}) },
        affiliateMarketing: { ...DEFAULT_PAGES_CONTENT.affiliateMarketing, ...(stored.affiliateMarketing ?? {}) },
        blog: { ...DEFAULT_PAGES_CONTENT.blog, ...(stored.blog ?? {}) },
        contact: { ...DEFAULT_PAGES_CONTENT.contact, ...(stored.contact ?? {}) },
        privacy: { ...DEFAULT_PAGES_CONTENT.privacy, ...(stored.privacy ?? {}) },
        terms: { ...DEFAULT_PAGES_CONTENT.terms, ...(stored.terms ?? {}) },
        returns: { ...DEFAULT_PAGES_CONTENT.returns, ...(stored.returns ?? {}) },
        faq: { ...DEFAULT_PAGES_CONTENT.faq, ...(stored.faq ?? {}) },
      };
    }
  } catch {
    // Fall through to defaults if the database is unreachable.
  }
  return DEFAULT_PAGES_CONTENT;
}

export async function updatePagesContent(content: PagesContent): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Only Admins can edit page content." };
  }
  if (!content.home.heading.trim()) {
    return { ok: false, error: "The homepage heading can't be empty." };
  }

  // Prisma's Json field type doesn't accept a plain TypeScript interface
  // directly — round-tripping through JSON turns it into the plain
  // key-value object Prisma expects.
  const value = JSON.parse(JSON.stringify(content));

  await prisma.setting.upsert({
    where: { key: PAGES_CONTENT_KEY },
    update: { value },
    create: { key: PAGES_CONTENT_KEY, value },
  });

  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/authors");
  revalidatePath("/affiliate");
  revalidatePath("/blog");
  revalidatePath("/contact");
  revalidatePath("/admin/site-settings");
  return { ok: true };
}
