import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* sharp is a native-binary dependency (used for every image upload —
   * logo, favicon, book covers, etc, see actions/images.ts). Without
   * this, Next.js can fail to correctly bundle its native binary for
   * Vercel's serverless functions, which fails silently at runtime in
   * production even though everything works fine in local dev. */
  serverExternalPackages: ["sharp"],
  experimental: {
    /* The actual root cause of "no image upload works at all": Next.js
     * Server Actions default to a 1MB request body limit. Every image
     * upload (logo, favicon, book covers, library uploads, everything
     * in actions/images.ts) goes through a Server Action, and real
     * photo/logo files are almost always well over 1MB — so they were
     * being rejected by Next.js itself, before the request ever reached
     * any of the upload code, regardless of what that code allows.
     * Kept at 4MB (not higher) to stay safely under Vercel's own
     * platform-level request-size ceiling for serverless functions —
     * matches MAX_UPLOAD_BYTES in actions/images.ts, so an oversized
     * file gets a clear, specific error from the app itself instead of
     * a harder, unexplained rejection from the platform. */
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
