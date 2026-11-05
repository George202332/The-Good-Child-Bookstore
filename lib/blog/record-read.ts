import { prisma } from "@/lib/prisma";

/** Server-only (not a Server Action, so the browser cannot call it): stores one blog read. The geo is read BEFORE the page
 * finishes, because request headers cannot be read after it. A missed read is never worth breaking a page over. */
export async function storeBlogRead(blogId: string, geo: { country: string | null; region: string | null }): Promise<void> {
  try {
    await prisma.blogRead.create({ data: { blogId, country: geo.country, region: geo.region } });
  } catch {
    /* ignore */
  }
}

export const looksLikeBot = (userAgent: string | null | undefined): boolean =>
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit/i.test(userAgent || "");
