import { startupRefusal } from "@/lib/runtime-env";

/**
 * Runs once when the server starts. The staging (Preview) site and any development copy REFUSE TO START if a live payment
 * key is found, so a mistake in Vercel can never let staging take real money. The live site is never stopped by this check.
 * The message names the variable only, never its value.
 */
export function register() {
  const reason = startupRefusal(process.env);
  if (reason) {
    console.error(reason);
    throw new Error(reason);
  }
}
