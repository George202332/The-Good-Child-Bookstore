"use server";

import { revalidatePath } from "next/cache";
import { authEither as auth } from "@/lib/auth-either";
import { runServiceHealth, setAlertEmail } from "@/lib/site-health/service-health";

/** Admin only. Runs every service check now. The checks only READ (no charge, payout or print order can come from them). */
export async function runServiceChecksNow(): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can do this." };
  try {
    await runServiceHealth();
    revalidatePath("/admin/site-health");
    revalidatePath("/admin/site-health");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The checks could not run." };
  }
}

/** Admin only. The address that receives service alerts (not hard-coded anywhere; empty = alerts off). */
export async function saveAlertEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can do this." };
  const res = await setAlertEmail(email);
  if (res.ok) revalidatePath("/admin/site-health");
  return res;
}
