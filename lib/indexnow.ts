import { prisma } from "@/lib/prisma";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

/**
 * IndexNow — a shared protocol Bing, Yandex, and others use to accept
 * "hey, this URL changed" pings instead of waiting for their next
 * crawl. Google doesn't participate in IndexNow itself, but keeping
 * Bing's index fresh in near-real-time is exactly what this was asked
 * for ("notify Bing and search engines").
 *
 * The key is generated once and stored in Settings, then served as
 * plain text at /indexnow-key.txt (see app/indexnow-key.txt/route.ts)
 * — IndexNow's protocol explicitly supports a keyLocation different
 * from the default /{key}.txt path, which sidesteps needing a
 * catch-all dynamic route at the site root that could collide with
 * real pages.
 */

const INDEXNOW_KEY_SETTING = "indexnow_key";

function generateKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  for (let i = 0; i < 32; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}

export async function getOrCreateIndexNowKey(): Promise<string> {
  const existing = await prisma.setting.findUnique({ where: { key: INDEXNOW_KEY_SETTING } });
  if (existing?.value && typeof existing.value === "string") return existing.value;

  const key = generateKey();
  await prisma.setting.upsert({
    where: { key: INDEXNOW_KEY_SETTING },
    update: { value: key },
    create: { key: INDEXNOW_KEY_SETTING, value: key },
  });
  return key;
}

/** Submits one or more URLs to IndexNow, logging the result either way
 * so there's a real record of what was submitted and whether it was
 * accepted, instead of firing pings into a black box. Never throws —
 * a failed submission shouldn't ever break the book/blog action that
 * triggered it. */
export async function submitUrlsToIndexNow(urls: string[]): Promise<{ ok: boolean; statusCode?: number }> {
  if (urls.length === 0) return { ok: false };
  try {
    const siteUrl = getPublicSiteUrl();
    const key = await getOrCreateIndexNowKey();
    const host = new URL(siteUrl).host;

    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${siteUrl}/indexnow-key.txt`,
        urlList: urls,
      }),
    });

    await prisma.indexNowSubmission.createMany({
      data: urls.map((url) => ({ url, statusCode: res.status, ok: res.ok })),
    });
    return { ok: res.ok, statusCode: res.status };
  } catch {
    await prisma.indexNowSubmission.createMany({
      data: urls.map((url) => ({ url, statusCode: null, ok: false })),
    });
    return { ok: false };
  }
}

export async function submitUrlToIndexNow(url: string): Promise<{ ok: boolean; statusCode?: number }> {
  return submitUrlsToIndexNow([url]);
}
