import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { BACKEND_ROLES, type Role } from "@/lib/roles";
import { logAuditEvent } from "@/lib/audit-log";
import { getRequestIp, getRequestUserAgent } from "@/lib/geo";
import { reportSystemError } from "@/lib/site-health/alert";

/** The actual credential-check logic for the backend instance — split
 * out the same way, and for the same reason, as lib/auth.ts's
 * authorizeReaderOrAuthor(): so the NextAuth `authorize()` callback
 * below can wrap it in one try/catch and report a genuinely
 * unexpected failure to Site Health without touching the real logic. */
async function authorizeBackendStaff(credentials: Partial<Record<"email" | "password", unknown>>) {
  // See lib/auth.ts's authorize() for why this trims, not just
  // lowercases — a stray whitespace character was making real
  // accounts fail lookup and get reported as "wrong password".
  const user = await prisma.user.findUnique({
    where: { email: String(credentials.email).trim().toLowerCase() },
  });
  if (!user) return null;
  // Only backend roles can ever authenticate through this
  // instance — a reader/author credential simply doesn't work
  // here, the same way it wouldn't on a genuinely separate site.
  if (!BACKEND_ROLES.includes(user.role as Role)) return null;

  const valid = await bcrypt.compare(String(credentials.password), user.passwordHash);
  if (!valid) {
    const ip = await getRequestIp();
    const userAgent = await getRequestUserAgent();
    await logAuditEvent(user.id, "LOGIN_FAILED", { ip, userAgent });
    return null;
  }
  if (user.suspended) return null;

  {
    const ip = await getRequestIp();
    const userAgent = await getRequestUserAgent();
    await logAuditEvent(user.id, "LOGIN", { ip, userAgent });
  }

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/**
 * A second, fully independent Auth.js (NextAuth v5) instance for the
 * backend (Admin/Editor/Accountant/Chief_Editor) — this is what
 * actually fixes the session-bleed bug: the public instance
 * (lib/auth.ts) and this one now each get their own, distinctly-named
 * session cookie, so signing into one never touches or overwrites the
 * other's session — including across tabs, since each tab reads
 * whichever cookie is relevant to the page it's on, and those cookies
 * are now genuinely separate values in the browser, not the same one.
 *
 * Deliberately reuses the exact same authorize() logic as the public
 * instance (same User table, same bcrypt check) — nothing new was
 * invented here, this is NextAuth's own supported way to run more than
 * one auth configuration side by side, just with a role restriction
 * and a different cookie name.
 */
export const { handlers: adminHandlers, auth: authAdmin, signIn: signInAdmin, signOut: signOutAdmin } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  cookies: {
    sessionToken: {
      name: "gcb-admin-session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
      // See the matching comment in lib/auth.ts — this cookie's
      // persistence is stripped after the fact too, in
      // app/api/auth-admin/[...nextauth]/route.ts (client sign-in) and
      // actions/admin-auth.ts (the Server-Action sign-in this instance
      // actually uses) via lib/session-cookie.ts.
    },
    callbackUrl: { name: "gcb-admin-callback-url", options: { sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" } },
    csrfToken: { name: "gcb-admin-csrf-token", options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" } },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          return await authorizeBackendStaff(credentials);
        } catch (e) {
          // Only a genuinely unexpected throw reaches here — an
          // ordinary wrong password/unknown email is already handled
          // (and tracked via LOGIN_FAILED) inside authorizeBackendStaff.
          await reportSystemError("AUTH", e, { email: String(credentials.email), backend: true });
          throw e;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        // See the matching comment in lib/auth.ts.
        token.signedInAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as Role;
        session.user.id = token.id as string;
        session.signedInAt = token.signedInAt;
      }
      return session;
    },
  },
});
