"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { DEFAULT_HOMEPAGE_CONTENT, type HomepageContent } from "@/lib/homepage-content";

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

  const value = JSON.parse(JSON.stringify(content));

  await prisma.setting.upsert({
    where: { key: HOMEPAGE_KEY },
    update: { value },
    create: { key: HOMEPAGE_KEY, value },
  });
  revalidatePath("/");
  revalidatePath("/admin/homepage");
  return { ok: true };
}