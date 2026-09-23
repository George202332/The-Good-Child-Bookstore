import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret, getGoogleOAuthClient } from "@/lib/google/oauth";

/** How much of a buffer to leave before actual expiry when deciding
 * whether to refresh — avoids a race where a token expires mid-request. */
const EXPIRY_BUFFER_MS = 60_000;

/**
 * Returns a guaranteed-valid Gmail-ready OAuth2 client for this user —
 * refreshing the access token first if it's expired (or about to be).
 * This is the single choke point every Gmail endpoint below calls
 * through; nothing else in the codebase should read GoogleOAuthToken
 * directly or call the Gmail API with a token it fetched itself.
 *
 * Throws a clear, catchable error (never a raw Google API 401) if the
 * user hasn't connected Gmail yet, or if the refresh itself fails
 * (e.g. the user revoked access from their Google account) — callers
 * turn this into a "reconnect your Gmail account" prompt rather than a
 * generic 500.
 */
export async function getValidGoogleClientForUser(userId: string) {
  const record = await prisma.googleOAuthToken.findUnique({ where: { userId } });
  if (!record) {
    throw new GoogleNotConnectedError();
  }

  const client = await getGoogleOAuthClient();
  const accessToken = decryptSecret(record.accessToken);
  const refreshToken = decryptSecret(record.refreshToken);

  const isExpired = record.expiresAt.getTime() - EXPIRY_BUFFER_MS <= Date.now();

  if (!isExpired) {
    client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
    return client;
  }

  // Expired (or about to be) — use the long-lived refresh token to get
  // a new access token before making any Gmail API call.
  client.setCredentials({ refresh_token: refreshToken });
  try {
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token || !credentials.expiry_date) {
      throw new Error("Google didn't return a new access token on refresh.");
    }
    await prisma.googleOAuthToken.update({
      where: { userId },
      data: {
        accessToken: encryptSecret(credentials.access_token),
        expiresAt: new Date(credentials.expiry_date),
        // Google sometimes rotates the refresh token itself — persist
        // the new one if given, otherwise keep the existing one.
        refreshToken: credentials.refresh_token ? encryptSecret(credentials.refresh_token) : record.refreshToken,
      },
    });
    client.setCredentials(credentials);
    return client;
  } catch (e) {
    // Refresh failed — almost always means the user revoked access on
    // Google's side. Remove the now-useless stored token so the UI
    // shows "connect your Gmail account" instead of retrying forever.
    await prisma.googleOAuthToken.delete({ where: { userId } }).catch(() => {});
    throw new GoogleReauthRequiredError(e instanceof Error ? e.message : "Token refresh failed.");
  }
}

export class GoogleNotConnectedError extends Error {
  constructor() {
    super("Gmail isn't connected for this account yet.");
    this.name = "GoogleNotConnectedError";
  }
}

export class GoogleReauthRequiredError extends Error {
  constructor(detail: string) {
    super(`Gmail access needs to be reconnected: ${detail}`);
    this.name = "GoogleReauthRequiredError";
  }
}

/** Convenience: a ready-to-use Gmail API client for this user, tokens
 * already guaranteed fresh. This is what every endpoint in
 * lib/google/gmail.ts actually calls. */
export async function getGmailClientForUser(userId: string) {
  const auth = await getValidGoogleClientForUser(userId);
  return google.gmail({ version: "v1", auth });
}
