"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { ChecklistGroup } from "@/lib/review-checklist";

const CHECKLIST_SETTINGS_KEY = "book_review_checklist";

export async function updateReviewChecklistTemplate(groups: ChecklistGroup[]): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Only Admins can edit the review checklist." };
  }
  if (!Array.isArray(groups) || groups.length === 0) {
    return { ok: false, error: "At least one checklist group is required." };
  }
  for (const g of groups) {
    if (!g.label.trim()) return { ok: false, error: "Every group needs a name." };
    if (g.items.some((it) => !it.label.trim())) return { ok: false, error: "Every checklist item needs a label." };
  }

  const value = JSON.parse(JSON.stringify(groups));
  await prisma.setting.upsert({
    where: { key: CHECKLIST_SETTINGS_KEY },
    update: { value },
    create: { key: CHECKLIST_SETTINGS_KEY, value },
  });

  revalidatePath("/admin/books/checklist-settings");
  return { ok: true };
}
