import { createHmac, timingSafeEqual } from "crypto";
import { absoluteFileUrl } from "@/lib/lulu-order";

/**
 * Secure, temporary links for the files Lulu has to download (the print interior and cover).
 *
 * A link looks like  https://<site>/api/lulu-files/<file id>?exp=<unix seconds>&sig=<signature>.
 * The signature is a keyed fingerprint (HMAC-SHA256) of the file id and the expiry time, made with a
 * server-only secret, so it cannot be forged and a link stops working once it expires. Nothing needs a
 * login or cookie, which is what Lulu requires. The secret is the existing AUTH_SECRET variable; when none
 * is configured nothing is signed and the caller falls back to the plain file link (so printing never breaks).
 */

/** Interior and cover links handed to Lulu's file check live for a few hours. */
export const CHECK_LINK_SECONDS = 6 * 60 * 60;
/** Links on a real print job live for days, because Lulu may fetch the files some time after the job is created. */
export const PRINT_JOB_LINK_SECONDS = 3 * 24 * 60 * 60;

function secret(): string | null {
  return process.env.AUTH_SECRET || process.env.SETTINGS_ENCRYPTION_KEY || null;
}

function signature(fileId: string, exp: number): string {
  const key = secret();
  if (!key) return "";
  return createHmac("sha256", key).update(`lulu-file:v1:${fileId}:${exp}`).digest("base64url");
}

export function signedFilePath(fileId: string, ttlSeconds: number, nowMs: number = Date.now()): string | null {
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  const sig = signature(fileId, exp);
  if (!sig) return null;
  return `/api/lulu-files/${encodeURIComponent(fileId)}?exp=${exp}&sig=${sig}`;
}

export function verifySignedFile(fileId: string, exp: string | null | undefined, sig: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!exp || !sig || !/^\d{1,12}$/.test(exp)) return false;
  if (Number(exp) * 1000 < nowMs) return false;
  const expected = signature(fileId, Number(exp));
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The address Lulu should use for a stored file. A stored "/api/files/<id>" path becomes a signed, expiring
 * link; anything else (an absolute address, no secret configured) is returned as before.
 */
/**
 * Staging only. The staging address sits behind Vercel's login wall, so Lulu would download a sign-in page instead of the file.
 * Vercel's "Protection Bypass for Automation" makes it let a link through when it carries the project's own bypass secret
 * (the Vercel variable VERCEL_AUTOMATION_BYPASS_SECRET). The secret is added to the link handed to Lulu and nowhere else:
 * never on the live site, never stored, never logged.
 */
export function withVercelBypass(link: string, env: { [k: string]: string | undefined } = process.env): string {
  if (env.VERCEL_ENV !== "preview") return link;
  const secret = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (!secret || !link.includes("/api/lulu-files/")) return link;
  return `${link}${link.includes("?") ? "&" : "?"}x-vercel-protection-bypass=${encodeURIComponent(secret)}`;
}

export function luluFileUrl(url: string | null | undefined, siteUrl: string, ttlSeconds: number): string | null {
  const m = url?.trim().match(/^\/api\/files\/([^/?#]+)/);
  if (m) {
    const signed = signedFilePath(decodeURIComponent(m[1]), ttlSeconds);
    if (signed) return withVercelBypass(`${siteUrl.replace(/\/+$/, "")}${signed}`);
  }
  return absoluteFileUrl(url, siteUrl);
}
