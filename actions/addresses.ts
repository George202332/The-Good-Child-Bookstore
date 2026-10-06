"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logSelfServiceEvent } from "@/lib/audit-log";
import { ADDRESS_FIELDS, buildChangeMetadata, diffFields } from "@/lib/activity-diff";

/** Real reader addresses — used for billing on digital orders and, once
 * print fulfillment is wired up, shipping on physical ones. New
 * functionality: the original kept addresses inside its localStorage
 * user blob (ensureReaderData()); this is a real Address table. */

export interface AddressRow {
  id: string;
  label: string;
  line: string;
  city: string;
  country: string;
  isDefault: boolean;
}

async function getReaderProfileId(): Promise<string | null> {
  return (await getReaderIds())?.readerId ?? null;
}

/** The reader profile id plus the owning user id (the activity log is keyed by user). */
async function getReaderIds(): Promise<{ readerId: string; userId: string } | null> {
  const session = await auth();
  if (session?.user?.role !== "READER") return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { readerProfile: true } });
  return user?.readerProfile ? { readerId: user.readerProfile.id, userId: user.id } : null;
}

export async function listMyAddresses(): Promise<AddressRow[]> {
  const readerId = await getReaderProfileId();
  if (!readerId) return [];
  return prisma.address.findMany({ where: { readerId }, orderBy: { createdAt: "asc" } });
}

export async function addAddress(input: { label: string; line: string; city: string; country: string }): Promise<{ ok: boolean; error?: string }> {
  const ids = await getReaderIds();
  if (!ids) return { ok: false, error: "Not authorized." };
  const { readerId, userId } = ids;
  if (!input.line.trim() || !input.city.trim() || !input.country.trim()) {
    return { ok: false, error: "Please fill in every field." };
  }

  const existingCount = await prisma.address.count({ where: { readerId } });
  const created = await prisma.address.create({
    data: {
      readerId,
      label: input.label.trim() || (existingCount === 0 ? "Home" : `Address ${existingCount + 1}`),
      line: input.line.trim(),
      city: input.city.trim(),
      country: input.country.trim(),
      isDefault: existingCount === 0,
    },
  });
  await logSelfServiceEvent(userId, "ADDRESS_ADDED", {
    ...(buildChangeMetadata("Added an address", diffFields({}, created, ADDRESS_FIELDS)) ?? { summary: "Added an address" }),
    addressId: created.id,
  });
  revalidatePath("/account/addresses");
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteAddress(addressId: string): Promise<{ ok: boolean; error?: string }> {
  const ids = await getReaderIds();
  if (!ids) return { ok: false, error: "Not authorized." };
  const { readerId, userId } = ids;
  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.readerId !== readerId) return { ok: false, error: "Not found." };

  await prisma.address.delete({ where: { id: addressId } });
  await logSelfServiceEvent(userId, "ADDRESS_REMOVED", {
    summary: `Removed address: ${address.label} (${address.city}, ${address.country})`,
    addressId,
    wasDefault: address.isDefault,
  });
  revalidatePath("/account/addresses");
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setDefaultAddress(addressId: string): Promise<{ ok: boolean; error?: string }> {
  const ids = await getReaderIds();
  if (!ids) return { ok: false, error: "Not authorized." };
  const { readerId, userId } = ids;
  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.readerId !== readerId) return { ok: false, error: "Not found." };

  await prisma.$transaction([
    prisma.address.updateMany({ where: { readerId }, data: { isDefault: false } }),
    prisma.address.update({ where: { id: addressId }, data: { isDefault: true } }),
  ]);
  // Making the already-default address default again changes nothing — no entry.
  if (!address.isDefault) {
    await logSelfServiceEvent(userId, "ADDRESS_DEFAULT_CHANGED", {
      summary: `Changed default address to: ${address.label} (${address.city}, ${address.country})`,
      addressId,
    });
  }
  revalidatePath("/account/addresses");
  revalidatePath("/admin/users");
  return { ok: true };
}
