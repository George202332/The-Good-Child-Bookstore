import { headers } from "next/headers";

export interface RequestGeo {
  country: string | null;
  region: string | null;
}

/** Real IP-based geolocation for the current request — Vercel's edge
 * network automatically attaches these headers to every request in
 * production (no API key, no third-party service, no extra network
 * call). Returns nulls in local development or any environment that
 * doesn't set them, rather than guessing — callers should treat a null
 * as "unknown," not as a specific place. */
export async function getRequestGeo(): Promise<RequestGeo> {
  try {
    const h = await headers();
    const country = h.get("x-vercel-ip-country");
    const region = h.get("x-vercel-ip-country-region");
    return { country: country || null, region: region || null };
  } catch {
    return { country: null, region: null };
  }
}
