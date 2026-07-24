/**
 * One-time CLI to create (or promote) an ADMIN, EDITOR, or ACCOUNTANT
 * account, since those roles have no public signup form by design (see
 * docs/architecture.md — they're backend-only, provisioned separately
 * from the Reader/Author/Affiliate self-serve signup pages).
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts you@example.com "a real password" "Your Name" ADMIN
 *   npx tsx scripts/create-admin.ts editor@example.com "a real password" "Editor Name" EDITOR
 *   npx tsx scripts/create-admin.ts accountant@example.com "a real password" "Accountant Name" ACCOUNTANT
 *
 * If the email already exists, this promotes that user's role instead of
 * creating a duplicate account.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Same role-sequenced account number ranges as lib/account-number.ts —
// duplicated here (rather than imported) since this script runs
// standalone via tsx, outside the Next.js app's module resolution.
const ROLE_BASE: Record<string, number> = {
  READER: 10_000_000,
  AUTHOR: 30_000_000,
  AFFILIATE: 50_000_000,
  EDITOR: 70_000_000,
  ADMIN: 80_000_000,
  ACCOUNTANT: 90_000_000,
};

async function generateAccountNumber(role: string): Promise<string> {
  const sequence = await prisma.idSequence.upsert({
    where: { role: role as "ADMIN" | "EDITOR" | "ACCOUNTANT" },
    update: { lastValue: { increment: 1 } },
    create: { role: role as "ADMIN" | "EDITOR" | "ACCOUNTANT", lastValue: 1 },
  });
  return String(ROLE_BASE[role] + sequence.lastValue);
}

async function main() {
  const [, , email, password, name, roleArg] = process.argv;
  const role = (roleArg || "ADMIN").toUpperCase();

  if (!email || !password || !name) {
    console.error('Usage: npx tsx scripts/create-admin.ts <email> <password> <name> [ADMIN|EDITOR|ACCOUNTANT]');
    process.exit(1);
  }
  if (role !== "ADMIN" && role !== "EDITOR" && role !== "ACCOUNTANT") {
    console.error("Role must be ADMIN, EDITOR, or ACCOUNTANT.");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: role as "ADMIN" | "EDITOR" | "ACCOUNTANT" } });
    console.log(`Promoted existing user ${email} to ${role}.`);
  } else {
    const accountNumber = await generateAccountNumber(role);
    await prisma.user.create({
      data: { accountNumber, email: email.toLowerCase(), name, passwordHash, role: role as "ADMIN" | "EDITOR" | "ACCOUNTANT" },
    });
    console.log(`Created new ${role} account for ${email} (account number ${accountNumber}).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
