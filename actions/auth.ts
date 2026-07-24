"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { generateAccountNumber } from "@/lib/account-number";

/**
 * Converted from doSignup() and handleReaderSignup()/handleAuthorSignup()/
 * handleAffiliateSignup() (the-good-child-bookstore_54_1.html:6364-6451).
 * The original stored accounts in localStorage with a hand-rolled
 * salt+hash; this creates a real User row (bcrypt-hashed password) plus
 * the matching role profile row. Only READER/AUTHOR/AFFILIATE are
 * reachable from these public signup forms — ADMIN/EDITOR accounts are
 * backend-only and are provisioned separately (see docs/architecture.md).
 */

export interface RegisterResult {
  ok: boolean;
  error?: string;
}

interface ReaderSignupInput {
  role: "READER";
  name: string;
  email: string;
  password: string;
}
interface AuthorSignupInput {
  role: "AUTHOR";
  name: string;
  penName?: string;
  email: string;
  genre: string;
  password: string;
}
interface AffiliateSignupInput {
  role: "AFFILIATE";
  name: string;
  email: string;
  password: string;
}

export type SignupInput = ReaderSignupInput | AuthorSignupInput | AffiliateSignupInput;

function generateReferralCode(name: string): string {
  const base = name.trim().split(" ")[0]?.toUpperCase().replace(/[^A-Z]/g, "") || "AFF";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

export async function registerUser(input: SignupInput): Promise<RegisterResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!email || !name || input.password.length < 6) {
    return { ok: false, error: "Please fill in every field (password must be at least 6 characters)." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const role: Role = input.role;
  const accountNumber = await generateAccountNumber(role);

  await prisma.user.create({
    data: {
      accountNumber,
      email,
      name,
      passwordHash,
      role,
      ...(input.role === "READER" ? { readerProfile: { create: {} } } : {}),
      ...(input.role === "AUTHOR"
        ? { authorProfile: { create: { primaryGenre: input.genre, penName: input.penName?.trim() || null } } }
        : {}),
      ...(input.role === "AFFILIATE"
        ? { affiliateProfile: { create: { referralCode: generateReferralCode(name) } } }
        : {}),
    },
  });

  return { ok: true };
}
