import { authAdmin } from "@/lib/auth-admin";

/**
 * Who may use Accounting. Checked on the SERVER by every action, page and download, never just by hiding a menu:
 *  - ADMIN can read and write.
 *  - INVESTOR can only read (view the Accounting tab and the Lulu Publishing tab). Nothing here lets an investor write.
 * Every other role, and anyone signed out, gets nothing.
 */
export interface AccountingActor {
  id: string;
  name: string;
  role: "ADMIN" | "INVESTOR";
}

async function actor(): Promise<AccountingActor | null> {
  const session = await authAdmin();
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== "ADMIN" && role !== "INVESTOR")) return null;
  return { id: session.user.id, name: session.user.name || session.user.email || "Admin", role };
}

/** Admin or investor: may look at everything. */
export async function accountingViewer(): Promise<AccountingActor | null> {
  return actor();
}

/** Admin only: the only role that can change anything. */
export async function accountingAdmin(): Promise<AccountingActor | null> {
  const a = await actor();
  return a && a.role === "ADMIN" ? a : null;
}
