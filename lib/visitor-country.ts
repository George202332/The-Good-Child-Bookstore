import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequestGeo } from "@/lib/geo";
import { visitorCountryList } from "@/lib/book-visibility";

/** Countries we know for the current visitor: the signed-in account's
 * User.country plus the request's IP-geo country. Empty when neither is
 * known (an unknown country never restricts a book). Reading the request
 * headers/session makes the calling route dynamic, so only call this from
 * routes that are already request-scoped. */
export async function getVisitorCountries(): Promise<string[]> {
  const accountCountry = await getAccountCountry();
  const geo = await getRequestGeo();
  return visitorCountryList({ accountCountry, geoCountry: geo.country });
}

/** User.country (ISO-2) of the signed-in account, or null (guest / not set). */
export async function getAccountCountry(): Promise<string | null> {
  try {
    const session = await auth();
    if (!session?.user?.id) return null;
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { country: true } });
    return user?.country ?? null;
  } catch {
    return null;
  }
}
