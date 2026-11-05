/**
 * Only the live site may be indexed. Staging (a Vercel "preview"), a developer's computer and anything else carry a no-index
 * signal on every page, in the robots file and in an X-Robots-Tag header. Decided by the deployment environment in code,
 * never by a setting that could be copied across by mistake.
 */
export function isIndexableDeployment(vercelEnv: string | undefined = process.env.VERCEL_ENV): boolean {
  return vercelEnv === "production";
}
