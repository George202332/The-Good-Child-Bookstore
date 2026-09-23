import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * AES-256-GCM encryption for secrets stored at rest — the Google OAuth
 * client secret in Settings, and every user's Gmail access/refresh
 * tokens in GoogleOAuthToken.
 *
 * Why this is necessary (not optional) for these specific values,
 * even though the rest of the app's Settings table stores plain JSON:
 * a client secret or a refresh token is a live, standing credential —
 * anyone who reads it can authenticate as this app to Google, or as
 * the linked user to Gmail, indefinitely (a refresh token doesn't
 * expire on its own). A leaked database backup, a misconfigured
 * read replica, or a compromised admin-read query would otherwise
 * hand over working credentials with zero further effort. Encrypting
 * them means a raw data leak alone isn't enough — the separate
 * SETTINGS_ENCRYPTION_KEY (never stored in the database, only in the
 * environment) is also required.
 *
 * This is deliberately NOT used for the other API keys already in
 * Settings (Paystack, Wise, Lulu, Resend) — that's an existing,
 * accepted trade-off in this codebase already, out of scope for this
 * change. It's applied here because Task 1/2 are new work, and OAuth
 * refresh tokens in particular are long-lived, silent credentials.
 */

function getKey(): Buffer {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "SETTINGS_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and add it to your environment — required before storing the Google client secret or any Gmail OAuth tokens."
    );
  }
  // scrypt derives a proper 32-byte key from whatever string length was
  // provided, rather than requiring the env var to be exactly 32 bytes.
  return scryptSync(secret, "gcb-settings-encryption", 32);
}

/** Encrypts a plaintext string. Output format: `iv:authTag:ciphertext`,
 * all hex-encoded, safe to store as a single string column/JSON value. */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV, standard for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypts a string produced by encryptSecret. Throws if the value was
 * tampered with (GCM's auth tag check fails) or the key is wrong. */
export function decryptSecret(stored: string): string {
  const key = getKey();
  const [ivHex, authTagHex, dataHex] = stored.split(":");
  if (!ivHex || !authTagHex || !dataHex) throw new Error("Malformed encrypted value.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

/** True if SETTINGS_ENCRYPTION_KEY is configured — callers should check
 * this before attempting to save a secret that requires encryption, so
 * a missing key produces a clear admin-facing error instead of a crash
 * deep in a save action. */
export function hasEncryptionKey(): boolean {
  return !!process.env.SETTINGS_ENCRYPTION_KEY;
}
