/**
 * One-time CLI to create (or promote) an ADMIN or EDITOR account, since
 * those roles have no public signup form by design (see docs/
 * architecture.md — they're backend-only, provisioned separately from
 * the Reader/Author/Affiliate self-serve signup pages).
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts you@example.com "a real password" "Your Name" ADMIN
 *   npx tsx scripts/create-admin.ts editor@example.com "a real password" "Editor Name" EDITOR
 *
 * If the email already exists, this promotes that user's role instead of
 * creating a duplicate account.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [, , email, password, name, roleArg] = process.argv;
  const role = (roleArg || "ADMIN").toUpperCase();

  if (!email || !password || !name) {
    console.error('Usage: npx tsx scripts/create-admin.ts <email> <password> <name> [ADMIN|EDITOR]');
    process.exit(1);
  }
  if (role !== "ADMIN" && role !== "EDITOR") {
    console.error("Role must be ADMIN or EDITOR.");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: role as "ADMIN" | "EDITOR" } });
    console.log(`Promoted existing user ${email} to ${role}.`);
  } else {
    await prisma.user.create({
      data: { email: email.toLowerCase(), name, passwordHash, role: role as "ADMIN" | "EDITOR" },
    });
    console.log(`Created new ${role} account for ${email}.`);
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
