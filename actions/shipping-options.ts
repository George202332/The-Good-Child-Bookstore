"use server";

import { getEnabledShippingLevels } from "@/lib/api-keys";
import { countryToIso2 } from "@/lib/user-country";
import { shippingLevelsFor, type LuluShippingLevel } from "@/lib/lulu-order";

export interface ShippingOptionRow {
  id: LuluShippingLevel;
  label: string;
  detail: string;
}

/** The shipping methods a customer shipping to this country can choose at
 * checkout (what the store has switched on in Admin → API Management,
 * narrowed to what applies in that country). Public: contains no secrets. */
export async function getShippingOptions(country: string): Promise<ShippingOptionRow[]> {
  const enabled = await getEnabledShippingLevels();
  return shippingLevelsFor(countryToIso2(country) ?? "", enabled).map((l) => ({ id: l.id, label: l.label, detail: l.detail }));
}
