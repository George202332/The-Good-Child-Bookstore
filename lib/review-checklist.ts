import { prisma } from "@/lib/prisma";

export interface ChecklistItem {
  id: string;
  label: string;
}
export interface ChecklistGroup {
  id: string;
  label: string;
  items: ChecklistItem[];
}

export const DEFAULT_REVIEW_CHECKLIST: ChecklistGroup[] = [
  {
    id: "metadata",
    label: "Metadata",
    items: [
      { id: "title", label: "Title" },
      { id: "author", label: "Author" },
      { id: "isbn", label: "SN / ISBN" },
    ],
  },
  {
    id: "appropriate",
    label: "Appropriate",
    items: [
      { id: "childrens_book", label: "Is this a children's book?" },
      { id: "age_selection", label: "Age selection" },
      { id: "copyright", label: "Copyright" },
    ],
  },
];

const CHECKLIST_SETTINGS_KEY = "book_review_checklist";

export async function getReviewChecklistTemplate(): Promise<ChecklistGroup[]> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: CHECKLIST_SETTINGS_KEY } });
    if (Array.isArray(setting?.value) && setting.value.length > 0) {
      return setting.value as unknown as ChecklistGroup[];
    }
  } catch {
    // Fall through to defaults if the database is unreachable.
  }
  return DEFAULT_REVIEW_CHECKLIST;
}
