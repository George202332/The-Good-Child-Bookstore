/** The five departments a message can belong to. Client-safe (no database). */
/* Soft, low-saturation tints that sit with the site's cream, lavender and muted purple. Text is always dark. */
export const DEPARTMENTS = [
  { key: "EDITOR", label: "Editor", color: "#4A3A7A", bg: "#E4DCF3", icon: "pen" },
  { key: "CHIEF_EDITOR", label: "Chief Editor", color: "#3A2C62", bg: "#D9CEEC", icon: "crown" },
  { key: "PAYOUTS", label: "Payouts", color: "#2F5A45", bg: "#D6EBDF", icon: "wallet" },
  { key: "ACCOUNTING", label: "Accounting", color: "#6E4A00", bg: "#F1E4C4", icon: "calc" },
  { key: "OPERATIONS", label: "Operations", color: "#4A4A63", bg: "#E1E0EA", icon: "gear" },
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
