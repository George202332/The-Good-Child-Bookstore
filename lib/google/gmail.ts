import type { gmail_v1 } from "googleapis";
import { getGmailClientForUser } from "@/lib/google/tokens";

export interface InboxMessageSummary {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
}

export interface InboxPage {
  messages: InboxMessageSummary[];
  nextPageToken?: string;
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/**
 * Fetching Emails — paginated inbox list (Sender, Subject, Snippet,
 * Date, Read/Unread), backed by users.messages.list.
 *
 * users.messages.list only returns message ids/threadIds, not the
 * fields a list view actually needs — so each id is followed up with
 * a users.messages.get(format: "metadata") call, fetched in parallel,
 * requesting only the headers actually used (keeps each of those
 * calls small and fast rather than pulling full message bodies just
 * to render a list row).
 */
export async function fetchInboxPage(userId: string, opts: { pageToken?: string; pageSize?: number; query?: string } = {}): Promise<InboxPage> {
  const gmail = await getGmailClientForUser(userId);

  const listRes = await gmail.users.messages.list({
    userId: "me",
    maxResults: opts.pageSize ?? 25,
    pageToken: opts.pageToken,
    q: opts.query, // optional Gmail search syntax, e.g. "is:unread"
    labelIds: ["INBOX"],
  });

  const ids = listRes.data.messages ?? [];
  if (ids.length === 0) {
    return { messages: [], nextPageToken: listRes.data.nextPageToken ?? undefined };
  }

  const details = await Promise.all(
    ids.map((m) =>
      gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      })
    )
  );

  const messages: InboxMessageSummary[] = details.map((res) => {
    const msg = res.data;
    return {
      id: msg.id!,
      threadId: msg.threadId!,
      from: headerValue(msg.payload?.headers, "From"),
      subject: headerValue(msg.payload?.headers, "Subject") || "(no subject)",
      snippet: msg.snippet ?? "",
      date: headerValue(msg.payload?.headers, "Date"),
      isUnread: (msg.labelIds ?? []).includes("UNREAD"),
    };
  });

  return { messages, nextPageToken: listRes.data.nextPageToken ?? undefined };
}

export interface FullMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  bodyHtml?: string;
  bodyText?: string;
  isUnread: boolean;
}

/** Gmail's raw part data is base64url — NOT standard base64. The
 * difference matters: base64url uses `-`/`_` instead of `+`/`/` and
 * drops padding, so decoding it as plain base64 silently corrupts any
 * message containing those substitute characters. This normalizes it
 * back to standard base64 first. */
function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

/** Recursively walks a MIME part tree to find the first text/plain and
 * text/html bodies. Handles arbitrarily nested multipart/alternative
 * and multipart/mixed structures (e.g. a plain+html message that also
 * has attachments as sibling parts) rather than assuming a flat
 * top-level part list. */
function extractBodies(part: gmail_v1.Schema$MessagePart | undefined, found: { html?: string; text?: string } = {}): { html?: string; text?: string } {
  if (!part) return found;

  if (part.mimeType === "text/html" && part.body?.data && !found.html) {
    found.html = decodeBase64Url(part.body.data);
  }
  if (part.mimeType === "text/plain" && part.body?.data && !found.text) {
    found.text = decodeBase64Url(part.body.data);
  }
  for (const child of part.parts ?? []) {
    extractBodies(child, found);
  }
  return found;
}

/**
 * Reading an Email — a single message by id, via users.messages.get
 * with format: "full" so the complete MIME structure (including
 * nested multipart bodies) is returned. Safely decodes base64url
 * (see decodeBase64Url above — this is the part that's easy to get
 * subtly wrong) rather than assuming a single top-level body part.
 */
export async function fetchMessageById(userId: string, messageId: string): Promise<FullMessage> {
  const gmail = await getGmailClientForUser(userId);
  const res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  const msg = res.data;

  const bodies = extractBodies(msg.payload);

  // A non-multipart message (mimeType text/plain or text/html at the
  // top level, no `parts` array at all) has its body directly on
  // payload.body rather than nested — handle that case too.
  if (!bodies.html && !bodies.text && msg.payload?.body?.data) {
    if (msg.payload.mimeType === "text/html") bodies.html = decodeBase64Url(msg.payload.body.data);
    else bodies.text = decodeBase64Url(msg.payload.body.data);
  }

  return {
    id: msg.id!,
    threadId: msg.threadId!,
    from: headerValue(msg.payload?.headers, "From"),
    to: headerValue(msg.payload?.headers, "To"),
    subject: headerValue(msg.payload?.headers, "Subject") || "(no subject)",
    date: headerValue(msg.payload?.headers, "Date"),
    bodyHtml: bodies.html,
    bodyText: bodies.text,
    isUnread: (msg.labelIds ?? []).includes("UNREAD"),
  };
}

/** Encodes to base64url (Gmail's `raw` send format needs this, not
 * standard base64 — the inverse of decodeBase64Url above). */
function encodeBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface SendEmailInput {
  to: string;
  subject: string;
  bodyHtml: string;
  /** Set both to thread this as a reply rather than a new message. */
  inReplyToMessageId?: string;
  threadId?: string;
}

/**
 * Sending Emails — compiles a compliant RFC 2822 message, base64url
 * encodes it, and calls users.messages.send. Setting In-Reply-To /
 * References + threadId is what makes a reply thread correctly in
 * Gmail's UI instead of appearing as an unrelated new message.
 */
export async function sendEmail(userId: string, input: SendEmailInput): Promise<{ id: string; threadId: string }> {
  const gmail = await getGmailClientForUser(userId);

  const fromRes = await gmail.users.getProfile({ userId: "me" });
  const fromAddress = fromRes.data.emailAddress ?? "me";

  const headers = [
    `From: ${fromAddress}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
  ];
  if (input.inReplyToMessageId) {
    headers.push(`In-Reply-To: ${input.inReplyToMessageId}`, `References: ${input.inReplyToMessageId}`);
  }

  const rfc2822Message = `${headers.join("\r\n")}\r\n\r\n${input.bodyHtml}`;
  const raw = encodeBase64Url(rfc2822Message);

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, threadId: input.threadId },
  });

  return { id: res.data.id!, threadId: res.data.threadId! };
}
