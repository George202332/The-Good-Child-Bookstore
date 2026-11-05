import { authEither } from "@/lib/auth-either";
import { canModerateContent, canViewFinancials } from "@/lib/roles";

/** Who may see website analytics: the same people who may moderate content. Money only for those who may see financials. */
export async function analyticsViewer(): Promise<{ includeMoney: boolean } | null> {
  const session = await authEither();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return null;
  return { includeMoney: canViewFinancials(role) };
}
