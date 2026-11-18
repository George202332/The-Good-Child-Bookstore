import { prisma } from "@/lib/prisma";

export const LULU_REMINDER_KEY = "lulu_reminder_days";
export const DEFAULT_REMINDER_DAYS = 3;

/** How many days between reminders to an author whose print file Lulu rejected. Admin setting; 3 by default. */
export async function getLuluReminderDays(): Promise<number> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: LULU_REMINDER_KEY } });
    const n = Number((row?.value as { days?: unknown } | null)?.days);
    return Number.isInteger(n) && n >= 1 && n <= 30 ? n : DEFAULT_REMINDER_DAYS;
  } catch {
    return DEFAULT_REMINDER_DAYS;
  }
}
