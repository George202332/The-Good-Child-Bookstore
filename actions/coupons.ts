"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { BACKEND_ROLES } from "@/lib/roles";

/**
 * Real, database-backed coupons — replaces the checkout page's
 * hardcoded VALID_COUPONS object (a direct port of the original's
 * `const VALID_COUPONS = { 'WELCOME10': 0.10, 'READMORE': 0.15 }`).
 * Admins can create new ones from `/admin/coupons`; checkout validates
 * against the real `Coupon` table.
 */

export interface ValidateCouponResult {
  ok: boolean;
  discountPct?: number;
  error?: string;
}

export async function validateCoupon(code: string): Promise<ValidateCouponResult> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { ok: false, error: "Enter a coupon code." };

  const coupon = await prisma.coupon.findUnique({ where: { code: trimmed } });
  if (!coupon) return { ok: false, error: "That coupon code is not valid." };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return { ok: false, error: "That coupon has expired." };
  }
  return { ok: true, discountPct: Number(coupon.percentOff) / 100 };
}

export interface CouponRow {
  id: string;
  code: string;
  percentOff: number;
  expiresAt: Date | null;
}

export async function listCoupons(): Promise<CouponRow[]> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !BACKEND_ROLES.includes(role)) return [];
  const coupons = await prisma.coupon.findMany({ orderBy: { code: "asc" } });
  return coupons.map((c: { id: string; code: string; percentOff: unknown; expiresAt: Date | null }) => ({
    id: c.id,
    code: c.code,
    percentOff: Number(c.percentOff),
    expiresAt: c.expiresAt,
  }));
}

export async function createCoupon(input: { code: string; percentOff: number; expiresAt?: string }): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "ADMIN") return { ok: false, error: "Only Admins can manage coupons." };

  const code = input.code.trim().toUpperCase();
  if (!code) return { ok: false, error: "Coupon code is required." };
  if (input.percentOff <= 0 || input.percentOff > 100) return { ok: false, error: "Percent off must be between 1 and 100." };

  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) return { ok: false, error: "A coupon with that code already exists." };

  await prisma.coupon.create({
    data: {
      code,
      percentOff: input.percentOff,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
  });
  revalidatePath("/admin/coupons");
  return { ok: true };
}

export async function deleteCoupon(couponId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can manage coupons." };
  await prisma.coupon.delete({ where: { id: couponId } });
  revalidatePath("/admin/coupons");
  return { ok: true };
}
