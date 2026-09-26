import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { BACKEND_ROLES, type Role } from "@/lib/roles";

/**
 * Auth.js (NextAuth v5) configuration — the public instance, for
 * Reader/Author accounts. A second, fully independent instance for
 * backend staff (Admin/Editor/Accountant/Chief_Editor) lives in
 * lib/auth-admin.ts, with its own session cookie — see that file for
 * why. Role is embedded in the session/JWT so middleware.ts and server
 * components can gate access without an extra database round trip on
 * every request.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  cookies: {
    sessionToken: {
      name: "gcb-session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email).toLowerCase() },
        });
        if (!user) return null;
        // Backend accounts can only ever authenticate through the
        // separate admin instance (lib/auth-admin.ts) — never here,
        // even with the right password. Prevented at this level
        // rather than caught and signed back out afterward.
        if (BACKEND_ROLES.includes(user.role as Role)) return null;

        const valid = await bcrypt.compare(String(credentials.password), user.passwordHash);
        if (!valid) return null;
        if (user.suspended) return null;

        // Checked once, right at password-success, so the very first
        // JWT this session ever gets already knows whether a second
        // factor is required — see the `jwt` callback below for how
        // this becomes `twoFactorVerified: false` until the
        // post-login challenge screen (app/account/layout.tsx) clears
        // it via the client-side session update() call.
        const twoFactorConfig = await prisma.twoFactorConfig.findUnique({ where: { userId: user.id } });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          twoFactorEnabled: !!twoFactorConfig?.enabled,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.twoFactorEnabled = user.twoFactorEnabled ?? false;
        // Nothing to verify if 2FA isn't enabled — session starts
        // already-satisfied so non-2FA users are never gated.
        token.twoFactorVerified = !user.twoFactorEnabled;
      }
      // Fired by the client's next-auth/react `update()` call, right
      // after a login challenge code (or a fresh setup) is verified —
      // see components/TwoFactorChallengeScreen.tsx and
      // app/account/settings/TwoFactorSettings.tsx.
      if (trigger === "update" && session) {
        const patch = session as { twoFactorEnabled?: boolean; twoFactorVerified?: boolean };
        if (typeof patch.twoFactorEnabled === "boolean") token.twoFactorEnabled = patch.twoFactorEnabled;
        if (typeof patch.twoFactorVerified === "boolean") token.twoFactorVerified = patch.twoFactorVerified;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as import("@/lib/roles").Role;
        session.user.id = token.id as string;
        session.user.twoFactorEnabled = (token.twoFactorEnabled as boolean) ?? false;
        session.user.twoFactorVerified = (token.twoFactorVerified as boolean) ?? true;
      }
      return session;
    },
  },
});
