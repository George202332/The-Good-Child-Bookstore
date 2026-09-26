import { randomInt, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";

/**
 * Two-factor authentication core logic — shared by the Settings UI
 * (setup/disable) and the post-login challenge gate. Kept entirely
 * separate from the auth session mechanism itself (lib/auth.ts only
 * reads the resulting `enabled` flag) and entirely separate from any
 * financial code path — nothing here can ever affect an order,
 * royalty, commission, or payout.
 *
 * Code security, per explicit requirement:
 *  - Randomly generated (crypto.randomInt, not Math.random)
 *  - 6 digits, single-use, short-lived (10 minutes)
 *  - Only a SHA-256 hash is ever stored — never the plaintext code
 *  - A hard cap of 5 verification attempts per challenge
 *  - Never logged, never returned to the client in any API response
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_SENDS_PER_HOUR = 6;

export type TwoFactorMethod = "EMAIL" | "SMS";

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

function maskPhone(phone: string): string {
  return phone.length <= 4 ? phone : `${"*".repeat(phone.length - 4)}${phone.slice(-4)}`;
}

export interface TwoFactorStatus {
  enabled: boolean;
  method: TwoFactorMethod | null;
  maskedDestination: string | null;
  pendingMethod: TwoFactorMethod | null;
  pendingMaskedDestination: string | null;
}

export async function getTwoFactorStatus(userId: string): Promise<TwoFactorStatus> {
  const config = await prisma.twoFactorConfig.findUnique({ where: { userId }, include: { user: true } });
  if (!config) return { enabled: false, method: null, maskedDestination: null, pendingMethod: null, pendingMaskedDestination: null };

  const maskedDestination = config.method === "SMS" && config.phoneNumber
    ? maskPhone(config.phoneNumber)
    : config.method === "EMAIL"
    ? maskEmail(config.user.email)
    : null;
  const pendingMaskedDestination = config.pendingMethod === "SMS" && config.pendingPhoneNumber
    ? maskPhone(config.pendingPhoneNumber)
    : config.pendingMethod === "EMAIL"
    ? maskEmail(config.user.email)
    : null;

  return {
    enabled: config.enabled,
    method: (config.method as TwoFactorMethod | null) ?? null,
    maskedDestination,
    pendingMethod: (config.pendingMethod as TwoFactorMethod | null) ?? null,
    pendingMaskedDestination,
  };
}

/** Rate limit shared by both setup and login challenges: a short
 * cooldown between individual sends, and a per-hour cap so a
 * malicious or buggy client can't be used to spam someone's inbox or
 * phone, or run up SMS costs. */
async function checkSendRateLimit(userId: string, purpose: "LOGIN" | "SETUP"): Promise<{ ok: boolean; error?: string }> {
  const recent = await prisma.twoFactorChallenge.findMany({
    where: { userId, purpose, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    take: MAX_SENDS_PER_HOUR,
  });
  if (recent.length > 0 && Date.now() - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "Please wait a moment before requesting another code." };
  }
  if (recent.length >= MAX_SENDS_PER_HOUR) {
    return { ok: false, error: "Too many codes requested recently. Please try again in an hour." };
  }
  return { ok: true };
}

async function issueChallenge(
  userId: string,
  purpose: "LOGIN" | "SETUP",
  method: TwoFactorMethod,
  destination: string
): Promise<{ ok: boolean; error?: string }> {
  const rate = await checkSendRateLimit(userId, purpose);
  if (!rate.ok) return rate;

  const code = generateCode();
  await prisma.twoFactorChallenge.create({
    data: {
      userId,
      purpose,
      method,
      destination,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  if (method === "EMAIL") {
    const result = await sendEmail(
      destination,
      "Your Good Child Bookstore verification code",
      `<div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto;">
        <h2>Your verification code</h2>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${code}</p>
        <p style="color: #888; font-size: 12px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email — your account is still secure.</p>
      </div>`
    );
    return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Could not send the email code." };
  }

  const smsResult = await sendSms(destination, `Your Good Child Bookstore verification code is ${code}. It expires in 10 minutes.`);
  return smsResult.ok ? { ok: true } : { ok: false, error: smsResult.error };
}

/** Starts (or restarts) 2FA setup — records the chosen method as
 * "pending" and sends a SETUP code to it. Nothing about the account's
 * existing, already-enabled 2FA (if any) changes until
 * confirmTwoFactorSetup succeeds. */
export async function startTwoFactorSetup(
  userId: string,
  method: TwoFactorMethod,
  phoneNumber: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (method === "SMS" && !phoneNumber?.trim()) return { ok: false, error: "Enter a phone number to use SMS codes." };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "Account not found." };

  await prisma.twoFactorConfig.upsert({
    where: { userId },
    update: { pendingMethod: method, pendingPhoneNumber: method === "SMS" ? phoneNumber!.trim() : null },
    create: { userId, pendingMethod: method, pendingPhoneNumber: method === "SMS" ? phoneNumber!.trim() : null },
  });

  const destination = method === "SMS" ? phoneNumber!.trim() : user.email;
  return issueChallenge(userId, "SETUP", method, destination);
}

async function verifyChallenge(userId: string, purpose: "LOGIN" | "SETUP", code: string): Promise<{ ok: boolean; error?: string; method?: TwoFactorMethod; destination?: string }> {
  const challenge = await prisma.twoFactorChallenge.findFirst({
    where: { userId, purpose, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return { ok: false, error: "No active code — request a new one." };
  if (challenge.expiresAt < new Date()) return { ok: false, error: "That code has expired — request a new one." };
  if (challenge.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Too many incorrect attempts — request a new code." };

  if (hashCode(code.trim()) !== challenge.codeHash) {
    await prisma.twoFactorChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    const remaining = MAX_ATTEMPTS - challenge.attempts - 1;
    return { ok: false, error: remaining > 0 ? `Incorrect code — ${remaining} attempt${remaining === 1 ? "" : "s"} left.` : "Too many incorrect attempts — request a new code." };
  }

  await prisma.twoFactorChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } });
  return { ok: true, method: challenge.method as TwoFactorMethod, destination: challenge.destination };
}

/** Confirms setup by checking the SETUP code, and only on success
 * promotes the pending method/phone to the live, enabled config. */
export async function confirmTwoFactorSetup(userId: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const result = await verifyChallenge(userId, "SETUP", code);
  if (!result.ok) return result;

  const config = await prisma.twoFactorConfig.findUnique({ where: { userId } });
  if (!config?.pendingMethod) return { ok: false, error: "No setup in progress." };

  await prisma.twoFactorConfig.update({
    where: { userId },
    data: {
      enabled: true,
      method: config.pendingMethod,
      phoneNumber: config.pendingPhoneNumber,
      pendingMethod: null,
      pendingPhoneNumber: null,
    },
  });
  return { ok: true };
}

/** Disable 2FA — the caller (actions/two-factor.ts) is responsible for
 * confirming the account's current password first; this function just
 * does the actual turn-off once that's already been checked. */
export async function disableTwoFactor(userId: string): Promise<{ ok: boolean }> {
  await prisma.twoFactorConfig.updateMany({
    where: { userId },
    data: { enabled: false, method: null, phoneNumber: null, pendingMethod: null, pendingPhoneNumber: null },
  });
  return { ok: true };
}

/** Sends the LOGIN challenge for an account that already has 2FA
 * enabled — called right after password verification succeeds, when
 * the login-flow gate needs the second factor before completing the
 * session. */
export async function sendLoginChallenge(userId: string): Promise<{ ok: boolean; error?: string; method?: TwoFactorMethod; maskedDestination?: string }> {
  const config = await prisma.twoFactorConfig.findUnique({ where: { userId }, include: { user: true } });
  if (!config?.enabled || !config.method) return { ok: false, error: "Two-factor authentication is not enabled on this account." };

  const destination = config.method === "SMS" ? config.phoneNumber! : config.user.email;
  const result = await issueChallenge(userId, "LOGIN", config.method as TwoFactorMethod, destination);
  if (!result.ok) return result;

  return {
    ok: true,
    method: config.method as TwoFactorMethod,
    maskedDestination: config.method === "SMS" ? maskPhone(config.phoneNumber!) : maskEmail(config.user.email),
  };
}

export async function verifyLoginChallenge(userId: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const result = await verifyChallenge(userId, "LOGIN", code);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
