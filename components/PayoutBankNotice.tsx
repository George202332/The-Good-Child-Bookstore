import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isLegacyPayoutType } from "@/lib/payout-method-availability";

/**
 * Shown at the top of the dashboard to an author or affiliate who chose PayPal or M-Pesa before, and has no bank
 * details yet: Bank Transfer is now the only payout method. Their earlier details are kept untouched.
 */
export async function PayoutBankNotice({ userId }: { userId: string }) {
  let show = false;
  try {
    const rows = await prisma.wiseRecipient.findMany({ where: { userId }, select: { type: true } });
    show = rows.some((r: { type: string }) => isLegacyPayoutType(r.type)) && !rows.some((r: { type: string }) => r.type === "bank");
  } catch {
    show = false;
  }
  if (!show) return null;
  return (
    <div className="field-hint" style={{ background: "var(--cream)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, color: "var(--ink)" }}>
      Bank Transfer is now the only way to receive payouts. Please <Link href="/account/profile" style={{ fontWeight: 700 }}>add your bank details</Link> so your next payout can be sent. Your earlier details are kept safely.
    </div>
  );
}
