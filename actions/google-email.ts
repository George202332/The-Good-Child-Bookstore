"use server";

import { authAdmin } from "@/lib/auth-admin";
import { prisma } from "@/lib/prisma";
import { fetchInboxPage, fetchMessageById, sendEmail, type InboxPage, type FullMessage } from "@/lib/google/gmail";
import { getGoogleRedirectUri } from "@/lib/google/oauth";
import { GoogleNotConnectedError, GoogleReauthRequiredError } from "@/lib/google/tokens";

async function requireAdmin(): Promise<string> {
  const session = await authAdmin();
  if (!session?.user || session.user.role !== "ADMIN") throw new Error("Not authorized.");
  return session.user.id;
}

/** Whether the current admin has a connected Gmail account — the UI
 * uses this to show either the inbox or a "Connect Gmail" prompt. */
export async function getGoogleConnectionStatus(): Promise<{ connected: boolean; email?: string }> {
  try {
    const userId = await requireAdmin();
    const record = await prisma.googleOAuthToken.findUnique({ where: { userId } });
    return record ? { connected: true, email: record.googleEmail } : { connected: false };
  } catch {
    return { connected: false };
  }
}

export async function disconnectGoogleAccount(): Promise<{ ok: boolean; error?: string }> {
  try {
    const userId = await requireAdmin();
    await prisma.googleOAuthToken.delete({ where: { userId } }).catch(() => {});
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't disconnect." };
  }
}

/** Wraps the two token-related errors from lib/google/tokens.ts into a
 * single, UI-friendly "needsReconnect" flag, so every action below
 * doesn't need to duplicate the same instanceof checks. */
function toResult<T>(data: T | null, error?: string, needsReconnect = false) {
  return { ok: !error, data, error, needsReconnect };
}

async function withGoogleErrorHandling<T>(fn: () => Promise<T>) {
  try {
    const data = await fn();
    return toResult(data);
  } catch (e) {
    if (e instanceof GoogleNotConnectedError || e instanceof GoogleReauthRequiredError) {
      return toResult(null, e.message, true);
    }
    return toResult(null, e instanceof Error ? e.message : "Something went wrong.");
  }
}

/** TASK 2.2 — Fetching Emails: paginated inbox list. */
export async function listInboxMessages(pageToken?: string, query?: string) {
  const userId = await requireAdmin();
  return withGoogleErrorHandling<InboxPage>(() => fetchInboxPage(userId, { pageToken, query }));
}

/** TASK 2.2 — Reading an Email: single message by id. */
export async function readMessage(messageId: string) {
  const userId = await requireAdmin();
  return withGoogleErrorHandling<FullMessage>(() => fetchMessageById(userId, messageId));
}

/** TASK 2.2 — Sending Emails: new message or a threaded reply. */
export async function sendOrReplyEmail(input: { to: string; subject: string; bodyHtml: string; inReplyToMessageId?: string; threadId?: string }) {
  const userId = await requireAdmin();
  if (!input.to.trim() || !input.subject.trim() || !input.bodyHtml.trim()) {
    return toResult(null, "To, subject, and body are all required.");
  }
  return withGoogleErrorHandling(() => sendEmail(userId, input));
}

/** Exposes the fixed redirect URI to the admin UI, so the API
 * Management page can show it directly to copy into Google Cloud
 * Console — one less place for a typo between the two systems. */
export async function getGoogleRedirectUriForDisplay(): Promise<string> {
  return getGoogleRedirectUri();
}
