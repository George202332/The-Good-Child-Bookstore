import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEPARTMENTS, type DepartmentKey } from "@/lib/message-departments";

/**
 * SERVER-ONLY: which departments a staff member belongs to.
 *  - Admin belongs to every department.
 *  - Existing roles keep working as before: Editor -> Editor, Chief Editor -> Chief Editor, Accountant -> Accounting.
 *  - On top of that a person can be given any number of departments (table StaffDepartment), so Payouts and Operations
 *    (which have no role of their own) and extra duties can be handed to separate people or teams later without rebuilding.
 */
export const ALL_DEPARTMENT_KEYS: DepartmentKey[] = DEPARTMENTS.map((d) => d.key);

export function isDepartmentKey(v: string): v is DepartmentKey {
  return (ALL_DEPARTMENT_KEYS as string[]).includes(v);
}

const ROLE_DEFAULT: Record<string, DepartmentKey | undefined> = { EDITOR: "EDITOR", CHIEF_EDITOR: "CHIEF_EDITOR", ACCOUNTANT: "ACCOUNTING" };

export async function departmentsOfStaff(userId: string, role: string): Promise<DepartmentKey[]> {
  if (role === "ADMIN") return ALL_DEPARTMENT_KEYS;
  const set = new Set<DepartmentKey>();
  const d = ROLE_DEFAULT[role];
  if (d) set.add(d);
  try {
    const rows = await prisma.$queryRaw<{ department: string }[]>(Prisma.sql`SELECT "department" FROM "StaffDepartment" WHERE "userId" = ${userId}`);
    for (const r of rows) if (isDepartmentKey(r.department)) set.add(r.department);
  } catch {
    // Table not created yet: the role defaults above still apply.
  }
  return ALL_DEPARTMENT_KEYS.filter((k) => set.has(k));
}

/** Staff list with their departments, for the admin to hand departments out. */
export async function listStaffWithDepartments(): Promise<{ id: string; name: string; email: string; role: string; departments: DepartmentKey[] }[]> {
  const staff = await prisma.user.findMany({ where: { role: { in: ["EDITOR", "CHIEF_EDITOR", "ACCOUNTANT", "ADMIN"] } }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: "asc" } });
  const out = [];
  for (const u of staff as { id: string; name: string; email: string; role: string }[]) out.push({ ...u, departments: await departmentsOfStaff(u.id, u.role) });
  return out;
}

/** Everyone who belongs to a department (admins always do): used to put a notice in front of the right team. */
export async function staffOfDepartment(department: DepartmentKey): Promise<string[]> {
  const ids = new Set<string>();
  const roles = Object.entries(ROLE_DEFAULT).filter(([, d]) => d === department).map(([r]) => r);
  const byRole = await prisma.user.findMany({ where: { role: { in: ["ADMIN", ...roles] as never } }, select: { id: true } });
  for (const u of byRole as { id: string }[]) ids.add(u.id);
  try {
    const rows = await prisma.$queryRaw<{ userId: string }[]>(Prisma.sql`SELECT "userId" FROM "StaffDepartment" WHERE "department" = ${department}`);
    for (const r of rows) ids.add(r.userId);
  } catch { /* table not created yet */ }
  return [...ids];
}
