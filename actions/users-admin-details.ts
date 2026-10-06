"use server";

import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";
import { payoutMethodLabel, formatAccountDetails } from "@/lib/payout-method-label";

/**
 * Read-only extra detail for the admin user detail page
 * (app/admin/users/[id]/page.tsx): account identity fields and the
 * user's saved payout destinations (WiseRecipient rows — the model name
 * is historical, see actions/payout-methods.ts). Returns null for
 * anyone who is not an ADMIN, so banking data can never reach another
 * role even if this action is called directly.
 */

export interface AdminPhoneEntry {
  label: string;
  value: string;
}

export interface AdminPayoutRecipient {
  id: string;
  isDefault: boolean;
  methodLabel: string;
  type: string;
  currency: string;
  accountHolderName: string;
  bankName: string | null;
  accountNumber: string | null;
  swiftOrRouting: string | null;
  intermediaryBank: string | null;
  country: string | null;
  paypalEmail: string | null;
  mpesaPhone: string | null;
  /** Everything stored in `details`, flattened, for older records whose
   * keys differ from the current form's. */
  rawDetails: string;
}

export interface UserAdminProfile {
  internalId: string;
  accountNumber: string;
  name: string;
  firstName: string;
  lastName: string | null;
  email: string;
  emailVerifiedAt: Date | null;
  phones: AdminPhoneEntry[];
  recipients: AdminPayoutRecipient[];
}

function str(details: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = details[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

export async function getUserAdminProfile(userId: string): Promise<UserAdminProfile | null> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      accountNumber: true,
      name: true,
      email: true,
      emailVerifiedAt: true,
      twoFactorConfig: { select: { method: true, phoneNumber: true } },
      wiseRecipients: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
      readerProfile: {
        select: {
          orders: {
            where: { shipPhone: { not: null } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { shipPhone: true },
          },
        },
      },
    },
  });
  if (!user) return null;

  const recipients: AdminPayoutRecipient[] = user.wiseRecipients.map((r) => {
    const d = (r.details && typeof r.details === "object" && !Array.isArray(r.details) ? r.details : {}) as Record<string, unknown>;
    return {
      id: r.id,
      isDefault: r.isDefault,
      methodLabel: payoutMethodLabel(r.type),
      type: r.type,
      currency: r.currency,
      accountHolderName: r.accountHolderName,
      bankName: str(d, ["bankName"]),
      accountNumber: str(d, ["accountNumber", "account_number", "iban"]),
      swiftOrRouting: str(d, ["swiftOrRoutingCode", "swiftCode", "swift_code", "routingNumber", "routing_number", "sortCode", "sort_code"]),
      intermediaryBank: str(d, ["intermediaryBank"]),
      country: str(d, ["country"]),
      paypalEmail: r.type === "email" ? str(d, ["email"]) : null,
      mpesaPhone: r.type === "mpesa" ? str(d, ["phoneNumber"]) : null,
      rawDetails: formatAccountDetails(d),
    };
  });

  // No User/profile phone column exists. Real sources: the number
  // verified for SMS two-factor, the M-Pesa payout number, and the phone
  // typed at the reader's most recent checkout.
  const phones: AdminPhoneEntry[] = [];
  const tf = user.twoFactorConfig;
  if (tf?.method === "SMS" && tf.phoneNumber) phones.push({ label: "two-factor SMS number", value: tf.phoneNumber });
  for (const r of recipients) {
    if (r.mpesaPhone) phones.push({ label: "M-Pesa payout number", value: r.mpesaPhone });
  }
  const checkoutPhone = user.readerProfile?.orders[0]?.shipPhone;
  if (checkoutPhone) phones.push({ label: "latest checkout", value: checkoutPhone });

  const trimmed = user.name.trim();
  const space = trimmed.indexOf(" ");
  const firstName = space === -1 ? trimmed : trimmed.slice(0, space);
  const lastName = space === -1 ? null : trimmed.slice(space + 1).trim() || null;

  return {
    internalId: user.id,
    accountNumber: user.accountNumber,
    name: user.name,
    firstName,
    lastName,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    phones,
    recipients,
  };
}
