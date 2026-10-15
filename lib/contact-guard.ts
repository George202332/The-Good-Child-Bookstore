/**
 * Pure rules that stop bots from using the public contact form (no
 * network, no database, so they can be unit tested). The server action in
 * actions/contact.ts applies them in this order: hidden trap field, fill
 * speed, field length/shape, link count, then a per-connection rate limit
 * and the Cloudflare Turnstile check.
 */

export const CONTACT_TOPICS = [
  "Order issue",
  "Book recommendation",
  "Author inquiry",
  "Affiliate inquiry",
  "Technical or website issue",
  "Refund or return",
  "Partnership or press",
  "General feedback",
  "Something else",
] as const;

export const CONTACT_LIMITS = {
  name: 100,
  email: 254,
  topic: 160,
  message: 5000,
  /** A person needs several seconds to fill in a form; scripts do it instantly. */
  minFillMs: 3000,
  /** A form left open longer than this is treated as stale. */
  maxFillMs: 1000 * 60 * 60 * 6,
  maxLinks: 2,
  perIpPerHour: 5,
} as const;

/** Escapes text before it is placed in the HTML email to support, so a
 * visitor can never inject markup or links into the message. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Removes line breaks and control characters (used for anything that goes
 * into an email subject or header, which must stay on one line). */
export function singleLine(s: string): string {
  return s.replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

export function countLinks(s: string): number {
  const matches = s.match(/(https?:\/\/|www\.)\S+/gi);
  return matches ? matches.length : 0;
}

export interface ContactCheckInput {
  name: string;
  email: string;
  topic: string;
  message: string;
  /** Hidden trap field — real visitors never see or fill it. */
  honeypot?: string;
  /** Milliseconds timestamp the form was shown (set by the page). */
  startedAt?: number;
}

export type ContactCheck =
  | { ok: true; silent?: false }
  /** `silent`: pretend it worked (bots get no error to learn from). */
  | { ok: false; silent: true }
  | { ok: false; silent?: false; error: string };

export function checkContactSubmission(input: ContactCheckInput, now: number = Date.now()): ContactCheck {
  // 1. Trap field: only a script fills it.
  if (input.honeypot && input.honeypot.trim()) return { ok: false, silent: true };

  // 2. Fill speed: a missing, future-dated or instant timestamp is a script.
  const started = Number(input.startedAt);
  if (!Number.isFinite(started) || started <= 0) return { ok: false, silent: true };
  const elapsed = now - started;
  if (elapsed < CONTACT_LIMITS.minFillMs) return { ok: false, silent: true };
  if (elapsed > CONTACT_LIMITS.maxFillMs) {
    return { ok: false, error: "This page has been open for a long time — please refresh it and send your message again." };
  }

  // 3. Shape and length.
  const name = input.name.trim();
  const email = input.email.trim();
  const message = input.message.trim();
  if (!name) return { ok: false, error: "Please enter your name." };
  if (name.length > CONTACT_LIMITS.name || /[\r\n<>]/.test(name)) return { ok: false, error: "Please enter a valid name." };
  if (!email || email.length > CONTACT_LIMITS.email || !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (!message) return { ok: false, error: "Please enter a message." };
  if (message.length > CONTACT_LIMITS.message) {
    return { ok: false, error: `Please keep your message under ${CONTACT_LIMITS.message} characters.` };
  }
  if (input.topic.length > CONTACT_LIMITS.topic) return { ok: false, error: "Please shorten the topic." };

  // 4. Spam-style content: a pile of links is the signature of a bot.
  if (countLinks(message) + countLinks(name) > CONTACT_LIMITS.maxLinks) {
    return { ok: false, error: "Your message has too many links. Please remove some and try again." };
  }
  return { ok: true };
}
