import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

/**
 * Assigns every account a human-readable, unique account number —
 * "assign an ID for any account created... authors should have a
 * different id sequence than the readers and affiliates... unique IDs
 * around 8 figures" from the explicit request.
 *
 * Each role gets its own independent sequence, distinguished by a
 * starting base so the ranges never overlap even as they grow:
 *   READER      10000001, 10000002, ...
 *   AUTHOR      30000001, 30000002, ...   (also covers affiliate capability — see lib/roles.ts)
 *   EDITOR      70000001, 70000002, ...
 *   ADMIN       80000001, 80000002, ...
 *   ACCOUNTANT  90000001, 90000002, ...
 *
 * Backed by IdSequence (one row per role, holding the last number
 * issued) so numbers are assigned atomically and never repeat, even
 * under concurrent signups.
 */

const ROLE_BASE: Record<Role, number> = {
  READER: 10_000_000,
  AUTHOR: 30_000_000,
  EDITOR: 70_000_000,
  ADMIN: 80_000_000,
  ACCOUNTANT: 90_000_000,
};

export async function generateAccountNumber(role: Role): Promise<string> {
  const sequence = await prisma.idSequence.upsert({
    where: { role },
    update: { lastValue: { increment: 1 } },
    create: { role, lastValue: 1 },
  });
  return String(ROLE_BASE[role] + sequence.lastValue);
}
