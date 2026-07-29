"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/roles";
import { generateAccountNumber } from "@/lib/account-number";
import { generateUniqueReferralCode } from "@/lib/referral-code";

/**
 * Admin-side account creation and management — "Admin can manage all
 * users" from the brief, extended per explicit request: create ANY
 * account type (Reader, Author, Affiliate, Editor, Admin) directly from
 * the backend, view/edit any account's details, and suspend/reactivate
 * an account (a suspended account can't sign in — see lib/auth.ts).
 */

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
  const accountNumber = await generateAccountNumber(input.role);
  const referralCode =
    input.role === "AUTHOR" || input.role === "AFFILIATE" ? await generateUniqueReferralCode(name) : undefined;

  await prisma.user.create({
    data: {
      accountNumber,
      email,
      name,
      passwordHash,
      role: input.role,
      ...(input.role === "READER" ? { readerProfile: { create: {} } } : {}),
      ...(input.role === "AUTHOR"
        ? { authorProfile: { create: {} }, affiliateProfile: { create: { referralCode: referralCode! } } }
        : {}),
      ...(input.role === "AFFILIATE"
        ? { affiliateProfile: { create: { referralCode: referralCode! } } }
        : {}),
      // EDITOR and ADMIN have no role-specific profile — they only ever use the backend.
    },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

export interface UserListRow {
  id: string;
  accountNumber: string;
  name: string;
  email: string;
  role: Role;
  suspended: boolean;
  createdAt: Date;
}

/** role: "ALL" or a specific Role — the query-by-type tabs at the top of
 * the Users page. */
export async function listUsers(role: Role | "ALL"): Promise<UserListRow[]> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return [];

  return prisma.user.findMany({
    where: role === "ALL" ? {} : { role },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { id: true, accountNumber: true, name: true, email: true, role: true, suspended: true, createdAt: true },
  });
}

export interface UserDetail extends UserListRow {
  authorBio: string | null;
  authorPrimaryGenre: string | null;
  affiliateReferralCode: string | null;
}

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { authorProfile: true, affiliateProfile: true },
  });
  if (!user) return null;

  return {
    id: user.id,
    accountNumber: user.accountNumber,
    name: user.name,
    email: user.email,
    role: user.role,
    suspended: user.suspended,
    createdAt: user.createdAt,
    authorBio: user.authorProfile?.bio ?? null,
    authorPrimaryGenre: user.authorProfile?.primaryGenre ?? null,
    affiliateReferralCode: user.affiliateProfile?.referralCode ?? null,
  };
}

export interface UpdateUserDetailInput {
  name: string;
  email: string;
  authorBio?: string;
  authorPrimaryGenre?: string;
}

export async function updateUserDetail(userId: string, input: UpdateUserDetailInput): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can edit accounts." };

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || !email) return { ok: false, error: "Name and email are required." };

  const emailOwner = await prisma.user.findUnique({ where: { email } });
  if (emailOwner && emailOwner.id !== userId) return { ok: false, error: "That email is already used by another account." };

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { authorProfile: true } });
  if (!user) return { ok: false, error: "Account not found." };

  await prisma.user.update({ where: { id: userId }, data: { name, email } });

  if (user.authorProfile) {
    await prisma.authorProfile.update({
      where: { id: user.authorProfile.id },
      data: {
        bio: input.authorBio?.trim() || null,
        primaryGenre: input.authorPrimaryGenre?.trim() || null,
      },
    });
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function toggleUserSuspension(userId: string): Promise<{ ok: boolean; error?: string; suspended?: boolean }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can suspend accounts." };
  if (userId === session.user.id) return { ok: false, error: "You can't suspend your own account." };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "Account not found." };

  const updated = await prisma.user.update({ where: { id: userId }, data: { suspended: !user.suspended } });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true, suspended: updated.suspended };
}

export async function updateUserRole(userId: string, newRole: Role): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can change roles." };
  if (userId === session.user.id) return { ok: false, error: "You can't change your own role." };

  await prisma.user.update({ where: { id: userId }, data: { role: newRole } });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
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
