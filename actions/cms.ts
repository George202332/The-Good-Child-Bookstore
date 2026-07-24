"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { DEFAULT_HOMEPAGE_CONTENT, type HomepageContent } from "@/lib/homepage-content";

/**
 * Homepage CMS — "Allow Admins to edit Hero... without changing code"
 * from the brief. Built on the existing generic `Setting` key-value
 * table rather than a bespoke table, since this is exactly the kind of
 * loosely-structured, admin-editable content that model exists for.
 */

const HOMEPAGE_KEY = "homepage_hero";

export async function getHomepageContent(): Promise<HomepageContent> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: HOMEPAGE_KEY } });
    if (setting?.value && typeof setting.value === "object") {
      return { ...DEFAULT_HOMEPAGE_CONTENT, ...(setting.value as Partial<HomepageContent>) };
    }
  } catch {
    // Fall through to defaults if the database is unreachable.
  }
  return DEFAULT_HOMEPAGE_CONTENT;
}

export async function updateHomepageContent(content: HomepageContent): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Only Admins can edit homepage content." };
  }
  if (!content.heading.trim()) {
    return { ok: false, error: "Heading can't be empty." };
  }

  await prisma.setting.upsert({
    where: { key: HOMEPAGE_KEY },
    update: { value: content },
    create: { key: HOMEPAGE_KEY, value: content },
  });
  revalidatePath("/");
  revalidatePath("/admin/homepage");
  return { ok: true };
}
