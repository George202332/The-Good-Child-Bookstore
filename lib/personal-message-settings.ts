import { prisma } from "@/lib/prisma";
import { isValidFee } from "@/lib/personal-message";

/** Server only: the Personal Message fee (admin-editable, saved in the Setting table, default zero). */
const KEY = "personal_message_fee";

export async function getPersonalMessageFee(): Promise<number> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    const v = (row?.value as { fee?: unknown } | null)?.fee;
    return isValidFee(v) ? v : 0;
  } catch {
    return 0;
  }
}

export async function savePersonalMessageFee(fee: number): Promise<void> {
  const value = { fee: Math.round(fee * 100) / 100 };
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}
