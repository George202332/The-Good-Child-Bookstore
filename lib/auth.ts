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

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as import("@/lib/roles").Role;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
