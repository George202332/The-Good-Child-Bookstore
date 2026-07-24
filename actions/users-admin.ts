"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/roles";

/**
 * Admin-side account creation — "Admin can manage all users" from the
 * brief, extended per explicit request: create ANY account type
 * (Reader, Author, Affiliate, Editor, Admin) directly from the backend,
 * not just via the public self-serve signup pages (which only ever
 * covered Reader/Author/Affiliate) or the CLI script (which only ever
 * covered Admin/Editor). This is the one place that can create all five.
 */

function generateReferralCode(name: string): string {
  const base = name.trim().split(" ")[0]?.toUpperCase().replace(/[^A-Z]/g, "") || "AFF";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export async function createUserAccount(input: CreateUserInput): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Only Admins can create accounts." };
  }

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !name) return { ok: false, error: "Name and email are required." };
  if (input.password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "An account with that email already exists." };

  const passwordHash = await bcrypt.hash(input.password, 10);

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: input.role,
      ...(input.role === "READER" ? { readerProfile: { create: {} } } : {}),
      ...(input.role === "AUTHOR" ? { authorProfile: { create: {} } } : {}),
      ...(input.role === "AFFILIATE"
        ? { affiliateProfile: { create: { referralCode: generateReferralCode(name) } } }
        : {}),
      // EDITOR and ADMIN have no role-specific profile — they only ever use the backend.
    },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateUserRole(userId: string, newRole: Role): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can change roles." };
  if (userId === session.user.id) return { ok: false, error: "You can't change your own role." };

  await prisma.user.update({ where: { id: userId }, data: { role: newRole } });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteUserAccount(userId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can delete accounts." };
  if (userId === session.user.id) return { ok: false, error: "You can't delete your own account." };

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
  return { ok: true };
}
