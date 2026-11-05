import { createHash } from "node:crypto";

/** Pure parts of rate limiting (no database), so they can be tested alone. */
export interface Rule { name: string; limit: number; windowSeconds: number }

export const RULES = {
  login: { name: "login", limit: 10, windowSeconds: 5 * 60 },
  search: { name: "search", limit: 60, windowSeconds: 60 },
  review: { name: "review", limit: 10, windowSeconds: 60 * 60 },
  shippingQuote: { name: "quote", limit: 30, windowSeconds: 10 * 60 },
} as const satisfies Record<string, Rule>;

export function windowStartOf(nowMs: number, windowSeconds: number): Date {
  const w = windowSeconds * 1000;
  return new Date(Math.floor(nowMs / w) * w);
}

export const shortHash = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 20);

