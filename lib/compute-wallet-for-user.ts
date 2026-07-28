import { prisma } from "@/lib/prisma";
import { computeWallet } from "@/lib/wallet";

/**
 * Same wallet math as actions/wallet.ts getMyWallet(), but for an
 * arbitrary userId rather than the current signed-in session — used by
 * the monthly payout cron job (app/api/cron/monthly-payouts/route.ts),
 * which needs to compute every user's wallet in a system context, not a
 * per-request session context.
 */
export async function computeWalletForUserId(userId: string, view: "author" | "affiliate"): Promise<{ available: number }> {
  try {
    let lines: { createdAt: Date; amount: number }[] = [];

    if (view === "author") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { authorProfile: { include: { books: { include: { saleLines: true } } } } },
      });
      const books = user?.authorProfile?.books ?? [];
      lines = books.flatMap((b: { saleLines: { createdAt: Date; authorShare: unknown }[] }) =>
        b.saleLines.map((l) => ({ createdAt: l.createdAt, amount: Number(l.authorShare) }))
      );
    } else {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          affiliateProfile: {
            include: {
              affiliateLinks: { include: { saleLines: true } },
              authorReferralEarnings: true,
            },
          },
        },
      });
      const links = user?.affiliateProfile?.affiliateLinks ?? [];
      const directLines = links.flatMap((l: { saleLines: { createdAt: Date; affiliateShare: unknown }[] }) =>
        l.saleLines.map((s) => ({ createdAt: s.createdAt, amount: Number(s.affiliateShare) }))
      );
      const referralLines = (user?.affiliateProfile?.authorReferralEarnings ?? []).map((s: { createdAt: Date; authorReferralShare: unknown }) => ({
        createdAt: s.createdAt,
        amount: Number(s.authorReferralShare),
      }));
      lines = [...directLines, ...referralLines];
    }

    const payouts = await prisma.payoutRequest.findMany({ where: { userId } });
    const paidOut = payouts
      .filter((p: { status: string }) => p.status === "PAID")
      .reduce((sum: number, p: { amount: unknown }) => sum + Number(p.amount), 0);
    const pending = payouts
      .filter((p: { status: string }) => p.status === "REQUESTED" || p.status === "APPROVED")
      .reduce((sum: number, p: { amount: unknown }) => sum + Number(p.amount), 0);

    return { available: computeWallet(lines, paidOut, pending).available };
  } catch {
    return { available: 0 };
  }
}
