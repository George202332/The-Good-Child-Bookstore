import type { Role } from "@/lib/roles";

declare module "next-auth" {
  interface User {
    id: string;
    role: Role;
    /** Public (Reader/Author) session only — whether 2FA is enabled
     * for this account, checked once at password-success. Unused by
     * the backend auth instance. */
    twoFactorEnabled?: boolean;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      /** Whether this account has 2FA enabled, and whether THIS
       * session has already satisfied it. `twoFactorVerified` starts
       * false for a 2FA-enabled account right after password
       * sign-in, and flips true once the login challenge succeeds
       * (via the client update() call) — see
       * app/account/layout.tsx and components/TwoFactorChallengeScreen.tsx. */
      twoFactorEnabled?: boolean;
      twoFactorVerified?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    twoFactorEnabled?: boolean;
    twoFactorVerified?: boolean;
  }
}
