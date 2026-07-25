"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/roles";

/**
 * A real Profile page for Reader, Author, and Affiliate accounts — the
 * account name/email plus whatever role-specific fields already existed
 * in the schema but had no UI to edit them (author bio/pen name/press
 * kit/primary genre, reader's preferred format and shopping age ranges,
 * affiliate's referral code display).
 */

export interface MyProfile {
  name: string;
  email: string;
  role: Role;
  // Author
  bio?: string;
  penName?: string;
  primaryGenre?: string;
  pressKitUrl?: string;
  availableForCollabs?: boolean;
  showEmailPublicly?: boolean;
  // Reader
  preferredFormat?: string;
  shoppingForAgeRanges?: string[];
  // Affiliate
  referralCode?: string;
}

export async function getMyProfile(): Promise<MyProfile | null> {
  const session = await auth();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { authorProfile: true, readerProfile: true, affiliateProfile: true },
  });
  if (!user) return null;

  return {
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.authorProfile?.bio ?? undefined,
    penName: user.authorProfile?.penName ?? undefined,
    primaryGenre: user.authorProfile?.primaryGenre ?? undefined,
    pressKitUrl: user.authorProfile?.pressKitUrl ?? undefined,
    availableForCollabs: user.authorProfile?.availableForCollabs,
    showEmailPublicly: user.authorProfile?.showEmailPublicly,
    preferredFormat: user.readerProfile?.preferredFormat ?? undefined,
    shoppingForAgeRanges: user.readerProfile?.shoppingForAgeRanges,
    referralCode: user.affiliateProfile?.referralCode ?? undefined,
  };
}

export async function updateMyProfile(input: {
  name: string;
  email: string;
  bio?: string;
  penName?: string;
  primaryGenre?: string;
  pressKitUrl?: string;
  availableForCollabs?: boolean;
  showEmailPublicly?: boolean;
  preferredFormat?: string;
  shoppingForAgeRanges?: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authorized." };

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || !email) return { ok: false, error: "Name and email are required." };

  const emailOwner = await prisma.user.findUnique({ where: { email } });
  if (emailOwner && emailOwner.id !== session.user.id) return { ok: false, error: "That email is already used by another account." };

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name, email },
    include: { authorProfile: true, readerProfile: true },
  });

  if (user.authorProfile) {
    await prisma.authorProfile.update({
      where: { id: user.authorProfile.id },
      data: {
        bio: input.bio?.trim() || null,
        penName: input.penName?.trim() || null,
        primaryGenre: input.primaryGenre?.trim() || null,
        pressKitUrl: input.pressKitUrl?.trim() || null,
        availableForCollabs: input.availableForCollabs ?? false,
        showEmailPublicly: input.showEmailPublicly ?? false,
      },
    });
  }

  if (user.readerProfile) {
    await prisma.readerProfile.update({
      where: { id: user.readerProfile.id },
      data: {
        preferredFormat: (input.preferredFormat as "EBOOK" | "PRINT" | "AUDIOBOOK" | undefined) || null,
        shoppingForAgeRanges: input.shoppingForAgeRanges ?? [],
      },
    });
  }

  revalidatePath("/account/profile");
  return { ok: true };
}
