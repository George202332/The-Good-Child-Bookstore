import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* sharp is a native-binary dependency (used for every image upload —
   * logo, favicon, book covers, etc, see actions/images.ts). Without
   * this, Next.js can fail to correctly bundle its native binary for
   * Vercel's serverless functions, which fails silently at runtime in
   * production even though everything works fine in local dev. */
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
