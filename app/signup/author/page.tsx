import { getRequestGeo } from "@/lib/geo";
import { COUNTRIES } from "@/lib/countries";
import { AuthorSignupForm } from "./AuthorSignupForm";

export const dynamic = "force-dynamic";

/** Server wrapper so the country field can be pre-filled from Vercel's
 * real IP-based geolocation (x-vercel-ip-country, see lib/geo.ts) before
 * the form ever reaches the browser — falls back to empty (the user
 * picks) if that header isn't present, e.g. in local development. */
export default async function SignupAuthorPage() {
  const geo = await getRequestGeo();
  const detected = geo.country && COUNTRIES.some((c) => c.iso2 === geo.country) ? geo.country! : "";
  return <AuthorSignupForm defaultCountry={detected} />;
}
