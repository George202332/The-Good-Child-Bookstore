"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/roles";
import { countryDisplayName, countryToIso2 } from "@/lib/user-country";
import { logSelfServiceEvent } from "@/lib/audit-log";
import { ACCOUNT_PROFILE_FIELDS, AUTHOR_PROFILE_FIELDS, buildChangeMetadata, diffFields } from "@/lib/activity-diff";

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
  accountNumber: string;
  memberSince: string;
  // Author
  bio?: string;
  penName?: string;
  primaryGenre?: string;
  pressKitUrl?: string;
  availableForCollabs?: boolean;
  showEmailPublicly?: boolean;
  socialLinks?: string[];
  country?: string;
  gender?: string;
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
    accountNumber: user.accountNumber,
    memberSince: user.createdAt.toISOString(),
    bio: user.authorProfile?.bio ?? undefined,
    penName: user.authorProfile?.penName ?? undefined,
    primaryGenre: user.authorProfile?.primaryGenre ?? undefined,
    pressKitUrl: user.authorProfile?.pressKitUrl ?? undefined,
    socialLinks: user.authorProfile?.socialLinks ?? [],
    availableForCollabs: user.authorProfile?.availableForCollabs,
    showEmailPublicly: user.authorProfile?.showEmailPublicly,
    // Falls back to the account-level country (set at signup / kept in
    // sync below) so the form never shows blank when only User.country is set.
    country: countryDisplayName(user.authorProfile?.country ?? user.country) ?? undefined,
    gender: user.authorProfile?.gender ?? undefined,
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
  socialLinks?: string[];
  country?: string;
  gender?: string;
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

  const before = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { authorProfile: true, readerProfile: true },
  });
  if (!before) return { ok: false, error: "Account not found." };

  // Country is stored in two places that the admin Users screens read
  // (User.country as an ISO code, AuthorProfile.country). A recognised
  // country is written to BOTH as the ISO code so they never drift; free
  // text that isn't a known country is kept on the author profile only and
  // never overwrites the account's code. A blank field clears only the
  // author-profile copy (as before) and leaves the account-level code alone.
  const typedCountry = input.country?.trim() || "";
  const countryIso = countryToIso2(typedCountry);
  const authorCountry = countryIso ?? (typedCountry || null);
  // A new, unrecognised country would leave the account-level code and the
  // author profile disagreeing, so only a recognised country (or the value
  // already on file, e.g. legacy free text) is accepted.
  if (before.authorProfile && typedCountry && !countryIso && typedCountry !== (before.authorProfile.country ?? "")) {
    return { ok: false, error: "Please enter a valid country name." };
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name, email, ...(before.authorProfile && countryIso ? { country: countryIso } : {}) },
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
        socialLinks: (input.socialLinks ?? []).map((s) => s.trim()).filter(Boolean),
        availableForCollabs: input.availableForCollabs ?? false,
        showEmailPublicly: input.showEmailPublicly ?? false,
        country: authorCountry,
        gender: input.gender?.trim() || null,
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

  // Activity log — what changed, only when something actually did. Country
  // is compared in its normalised (ISO) form so "Kenya" -> "KE" isn't a change.
  const norm = (v: string | null | undefined) => countryToIso2(v) ?? v ?? "";
  const beforeCountry = norm(before.authorProfile?.country ?? before.country);
  const afterCountry = before.authorProfile ? norm(authorCountry ?? user.country) : norm(before.country);
  const accountBefore = {
    name: before.name,
    email: before.email,
    country: beforeCountry,
    preferredFormat: before.readerProfile?.preferredFormat,
    shoppingForAgeRanges: before.readerProfile?.shoppingForAgeRanges,
  };
  const accountAfter = {
    name: user.name,
    email: user.email,
    country: afterCountry,
    preferredFormat: before.readerProfile ? input.preferredFormat || null : undefined,
    shoppingForAgeRanges: before.readerProfile ? input.shoppingForAgeRanges ?? [] : undefined,
  };
  await logSelfServiceEvent(
    session.user.id,
    "PROFILE_UPDATED",
    buildChangeMetadata("Updated profile", diffFields(accountBefore, accountAfter, ACCOUNT_PROFILE_FIELDS))
  );
  if (before.authorProfile) {
    await logSelfServiceEvent(
      session.user.id,
      "AUTHOR_PROFILE_UPDATED",
      buildChangeMetadata(
        "Updated author profile",
        diffFields(before.authorProfile, {
          bio: input.bio?.trim() || null,
          penName: input.penName?.trim() || null,
          primaryGenre: input.primaryGenre?.trim() || null,
          pressKitUrl: input.pressKitUrl?.trim() || null,
          socialLinks: (input.socialLinks ?? []).map((s) => s.trim()).filter(Boolean),
          availableForCollabs: input.availableForCollabs ?? false,
          showEmailPublicly: input.showEmailPublicly ?? false,
          gender: input.gender?.trim() || null,
        }, AUTHOR_PROFILE_FIELDS)
      )
    );
  }

  // The admin Users list and detail pages read these same rows.
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${session.user.id}`);
  revalidatePath("/account/profile");
  return { ok: true };
}
