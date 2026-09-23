import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { getGoogleCredentials } from "@/lib/api-keys";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

/** Default scope if none is configured in Site Settings — read-only
 * plus send, which covers the inbox-list/read/send-reply surface this
 * integration exposes. An admin can widen this (e.g. to gmail.modify,
 * for marking read/archiving) from API Management without a code
 * change, since the scope string is read fresh from the database on
 * every auth URL generation. */
const DEFAULT_SCOPES = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email";

/** The fixed callback path — this exact, full URL (site origin +
 * this path) is what must be registered as an authorized redirect URI
 * in the Google Cloud Console OAuth client (see Task 3 setup notes). */
export function getGoogleRedirectUri(): string {
  return `${getPublicSiteUrl()}/api/integrations/google/callback`;
}

/** Builds an OAuth2 client using the credentials currently configured
 * in Site Settings → API Management (or the environment as a
 * fallback). Throws a clear, admin-facing error if nothing is
 * configured yet, rather than failing deep inside a Google API call. */
export async function getGoogleOAuthClient() {
  const { clientId, clientSecret } = await getGoogleCredentials();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Workspace isn't configured yet — add a Client ID and Client Secret in Admin \u2192 API Management \u2192 Google Workspace Configuration."
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, getGoogleRedirectUri());
}

/** Generates the URL to send a user to for Google's consent screen.
 * `state` should be a signed/random value your callback route can
 * verify to prevent CSRF — the callback route below generates and
 * checks one automatically via a short-lived, httpOnly cookie, so
 * callers of this function don't need to manage it themselves. */
export async function generateGoogleAuthUrl(state: string): Promise<string> {
  const client = await getGoogleOAuthClient();
  const { scopes } = await getGoogleCredentials();
  return client.generateAuthUrl({
    access_type: "offline", // required to receive a refresh_token
    prompt: "consent", // forces refresh_token on every connect, not just the first time
    scope: (scopes || DEFAULT_SCOPES).split(/\s+/).filter(Boolean),
    state,
  });
}

/** Exchanges an authorization code (from the callback's `code` query
 * param) for access + refresh tokens, and saves them — encrypted,
 * see lib/crypto.ts — linked to the given user. Called once, right
 * after Google redirects back to /api/integrations/google/callback. */
export async function exchangeCodeAndStoreTokens(userId: string, code: string): Promise<void> {
  const client = await getGoogleOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    // No refresh_token usually means the user already granted consent
    // before and Google didn't re-issue one — prompt: "consent" above
    // is what prevents this in the normal flow, but surface it clearly
    // if it happens rather than silently storing a half-usable token.
    throw new Error(
      "Google didn't return a refresh token. This usually means access was already granted previously — revoke it at https://myaccount.google.com/permissions and try connecting again."
    );
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ auth: client, version: "v2" });
  const { data: profile } = await oauth2.userinfo.get();

  await prisma.googleOAuthToken.upsert({
    where: { userId },
    create: {
      userId,
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: encryptSecret(tokens.refresh_token),
      expiresAt: new Date(tokens.expiry_date),
      scope: tokens.scope ?? DEFAULT_SCOPES,
      googleEmail: profile.email ?? "",
    },
    update: {
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: encryptSecret(tokens.refresh_token),
      expiresAt: new Date(tokens.expiry_date),
      scope: tokens.scope ?? DEFAULT_SCOPES,
      googleEmail: profile.email ?? "",
    },
  });
}

/** Re-exported for the token-refresh middleware in lib/google/tokens.ts,
 * so it doesn't need its own encrypt/decrypt import. */
export { encryptSecret, decryptSecret };
