import { prisma } from "@/lib/prisma";

/** The admin switch "Allow real Lulu orders from staging". OFF by default. Kept in the staging database (Setting row
 * "staging_lulu_switch"); it has no effect on the live site. Reading never throws: any problem means OFF. */
const KEY = "staging_lulu_switch";

export async function getStagingLuluSwitch(): Promise<{ on: boolean; changedAt?: string; changedBy?: string }> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    const v = row?.value as { on?: unknown; changedAt?: string; changedBy?: string } | null;
    return { on: v?.on === true, changedAt: v?.changedAt, changedBy: v?.changedBy };
  } catch {
    return { on: false };
  }
}

export async function setStagingLuluSwitch(on: boolean, by: string): Promise<void> {
  const value = { on, changedAt: new Date().toISOString(), changedBy: by };
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
}
