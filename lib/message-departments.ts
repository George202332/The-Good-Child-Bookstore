/** The five departments a message can belong to. Client-safe (no database). */
export const DEPARTMENTS = [
  { key: "EDITOR", label: "Editor", color: "#6B3FA0", bg: "#EFE6F8", icon: "pen" },
  { key: "CHIEF_EDITOR", label: "Chief Editor", color: "#4B2A7A", bg: "#E4D8F2", icon: "crown" },
  { key: "PAYOUTS", label: "Payouts", color: "#1F6B4A", bg: "#DDF1E6", icon: "wallet" },
  { key: "ACCOUNTING", label: "Accounting", color: "#9A5B00", bg: "#FCEFD2", icon: "calc" },
  { key: "OPERATIONS", label: "Operations", color: "#1F5C8A", bg: "#DCEBF7", icon: "gear" },
] as const;

export type DepartmentKey = (typeof DEPARTMENTS)[number]["key"];

export function departmentOf(key: string | null | undefined) {
  return DEPARTMENTS.find((d) => d.key === key) ?? null;
}

/** Maps a department onto the older support category so the admin Messages tab keeps working unchanged. */
export function categoryForDepartment(key: DepartmentKey): "ACCOUNT" | "PAYMENTS" | "TECHNICAL" | "CONTENT" | "OTHER" {
  switch (key) {
    case "PAYOUTS":
    case "ACCOUNTING": return "PAYMENTS";
    case "EDITOR":
    case "CHIEF_EDITOR": return "CONTENT";
    default: return "OTHER";
  }
}

/** Reverse: an older message with only a support category still gets a sensible badge. */
export function departmentForCategory(category: string | null | undefined): DepartmentKey | null {
  switch (category) {
    case "PAYMENTS": return "PAYOUTS";
    case "CONTENT": return "EDITOR";
    case "ACCOUNT":
    case "TECHNICAL":
    case "OTHER": return "OPERATIONS";
    default: return null;
  }
}
