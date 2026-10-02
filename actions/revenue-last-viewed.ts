"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Reads the signed-in user's `lastViewedRevenueAt` (see
 * prisma/schema.prisma on User) and immediately bumps it to now() —
 * but returns the PREVIOUS value, not the new one, so the caller
 * (app/account/revenue/page.tsx) can still compare "what's new" against
 * where they left off on their last visit, while this visit's own
 * timestamp is already persisted for the NEXT one.
 *
 * Persisted on the User row rather than kept in any client-side state
 * specifically because the spec requires it to survive a refresh or a
 * brand new session — a React state variable or localStorage value
 * would reset the moment the page is reloaded (localStorage is also
 * per-browser, so it wouldn't follow the account to a different
 * device), while this is a plain database column every surface reads
 * and writes identically.
 *
 * Returns null on the very first-ever visit (nothing to compare
 * against yet) or if the user isn't signed in — both treated by the
 * caller as "nothing to highlight," never as "everything is new."
 */
export async function bumpLastViewedRevenueAt(): Promise<Date | null> {
  const session = await auth();
  if (!session?.user) return null;

  try {
    const previous = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { lastViewedRevenueAt: true },
    });
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastViewedRevenueAt: new Date() },
    });
    return previous?.lastViewedRevenueAt ?? null;
  } catch {
    // Best-effort — a failed read/write here should never block the
    // Revenue page itself from rendering with its real figures.
    return null;
  }
}
