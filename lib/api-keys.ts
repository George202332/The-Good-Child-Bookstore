import { prisma } from "@/lib/prisma";

/**
 * Reads an API credential, preferring the value saved in Site Settings
 * (backend-editable, see actions/site-settings.ts) over the equivalent
 * environment variable — lets George manage these from the admin panel
 * instead of needing help editing Vercel's environment variables. Falls
 * back to the env var if nothing's been saved in the database yet, so
 * existing env-var-based setups keep working unchanged.
 */
export async function getApiKey(dbField: "luluApiKey" | "paypalClientId" | "paypalClientSecret" | "paystackSecretKey", envVar: string): Promise<string | undefined> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "site_settings" } });
    const apiKeys = (setting?.value as { apiKeys?: Record<string, string> } | undefined)?.apiKeys;
    const dbValue = apiKeys?.[dbField];
    if (dbValue && dbValue.trim()) return dbValue.trim();
  } catch {
    // Fall through to the environment variable if the database is unreachable.
  }
  return process.env[envVar];
}
