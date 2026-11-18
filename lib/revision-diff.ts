import { fileRefKey } from "@/lib/revision-trigger";
import { aiDisplayText } from "@/lib/ai-declaration";
import type { ProjectedBook } from "@/lib/revision-state";

/**
 * "What Changed": the live, approved book set beside the author's edit, one row per thing that differs. Pure (no database),
 * so a reviewer sees exactly the edit that approving would apply.
 */

export interface ChangeRow { label: string; before: string; after: string }

export interface LiveBookForDiff {
  /** The live book's columns (title, description, prices, coverImageUrl, submissionMetadata...). */
  fields: Record<string, unknown>;
  files: { kind: string; url: string }[];
  genreName?: string;
  subcategoryName?: string;
}

const NONE = "None";

const money = (v: unknown): string => (v == null || v === "" || Number.isNaN(Number(v)) ? NONE : `$${Number(v).toFixed(2)}`);
const text = (v: unknown): string => {
  if (v == null) return NONE;
  if (Array.isArray(v)) return v.length ? v.join(", ") : NONE;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  const s = String(v).trim();
  return s || NONE;
};

const COLUMNS: { key: string; label: string; fmt: (v: unknown) => string }[] = [
  { key: "title", label: "Title", fmt: text },
  { key: "subtitle", label: "Subtitle", fmt: text },
  { key: "description", label: "Description", fmt: text },
  { key: "ebookPrice", label: "eBook Price", fmt: money },
  { key: "audiobookPrice", label: "Audiobook Price", fmt: money },
  { key: "paperbackPrice", label: "Paperback Price", fmt: money },
  { key: "hardcoverPrice", label: "Hardcover Price", fmt: money },
  { key: "ageGroup", label: "Age Group", fmt: text },
  { key: "language", label: "Language", fmt: text },
  { key: "category", label: "Category", fmt: text },
  { key: "subcategory", label: "Subcategory", fmt: text },
  { key: "restrictedCountries", label: "Restricted Countries", fmt: text },
];

const META: { key: string; label: string; fmt?: (v: unknown) => string }[] = [
  { key: "edition", label: "Edition" }, { key: "seriesName", label: "Series" }, { key: "publisher", label: "Publisher" },
  { key: "publicationDate", label: "Publication Date" }, { key: "readingLevel", label: "Reading Level" },
  { key: "authorFirstName", label: "Author First Name" }, { key: "authorLastName", label: "Author Last Name" },
  { key: "authorBio", label: "Author Bio" }, { key: "keywords", label: "Keywords" },
  { key: "copyrightHolder", label: "Copyright Holder" }, { key: "licenseType", label: "License Type" },
  { key: "aiDeclaration", label: "AI Use Declaration", fmt: (v) => (typeof v === "string" && v ? aiDisplayText(v) : NONE) },
  { key: "trimSizeCode", label: "Trim Size" }, { key: "binding", label: "Paperback Binding" }, { key: "interiorColor", label: "Interior Color" },
  { key: "printQuality", label: "Print Quality" }, { key: "paperType", label: "Paper Type" }, { key: "coverFinish", label: "Cover Finish" },
  { key: "linenColor", label: "Linen Color" }, { key: "foilColor", label: "Foil Color" },
  { key: "paperbackEnabled", label: "Paperback Offered" }, { key: "hardcoverEnabled", label: "Hardcover Offered" },
  { key: "privatePrinting", label: "Private Printing" }, { key: "luluGlobalDistribution", label: "Lulu Global Distribution" },
  { key: "worldwideRights", label: "Worldwide Rights" }, { key: "taxSetting", label: "Tax Setting" },
];

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function describeChanges(live: LiveBookForDiff, edit: ProjectedBook): ChangeRow[] {
  const rows: ChangeRow[] = [];
  const add = (label: string, before: string, after: string) => { if (before !== after) rows.push({ label, before, after }); };

  for (const c of COLUMNS) {
    const a = live.fields[c.key], b = edit.fields[c.key];
    if (c.key in edit.fields && !same(a ?? null, b ?? null) && !(c.fmt(a) === c.fmt(b))) add(c.label, c.fmt(a), c.fmt(b));
  }
  add("Genre", text(live.genreName), text(edit.genreName));
  if (edit.subcategoryName && live.subcategoryName !== edit.subcategoryName && !("subcategory" in edit.fields)) add("Subcategory", text(live.subcategoryName), text(edit.subcategoryName));

  const liveMeta = (live.fields.submissionMetadata as Record<string, unknown> | null) ?? {};
  const editMeta = (edit.fields.submissionMetadata as Record<string, unknown> | null) ?? {};
  for (const m of META) {
    const fmt = m.fmt ?? text;
    add(m.label, fmt(liveMeta[m.key]), fmt(editMeta[m.key]));
  }
  for (const [k, label] of [["paperbackRetailPrice", "Paperback Retail Price"], ["hardcoverRetailPrice", "Hardcover Retail Price"]] as const) {
    if (k in editMeta || k in liveMeta) add(label, money(liveMeta[k]), money(editMeta[k]));
  }

  const fileOf = (files: { kind: string; url: string }[], kind: string) => fileRefKey(files.find((f) => f.kind === kind)?.url);
  const fileRow = (label: string, kind: string) => {
    const a = fileOf(live.files, kind), b = fileOf(edit.files, kind);
    if (a !== b) add(label, a ? "Current file" : NONE, b ? "New file uploaded" : "Removed");
  };
  fileRow("Manuscript / Print Interior", "MANUSCRIPT");
  fileRow("Audiobook File", "AUDIOBOOK");
  fileRow("Sample Pages", "SAMPLE");
  const coverA = fileRefKey(String(live.fields.coverImageUrl ?? "")), coverB = fileRefKey(String(edit.fields.coverImageUrl ?? ""));
  if (coverA !== coverB) add("Cover", coverA ? "Current cover" : NONE, coverB ? "New cover" : "Removed");
  const wrapA = String(liveMeta.customBackCoverPdfFileId ?? ""), wrapB = String(editMeta.customBackCoverPdfFileId ?? "");
  if (wrapA !== wrapB) add("Full Wrap Cover PDF", wrapA ? "Current file" : NONE, wrapB ? "New file uploaded" : "Removed");

  return rows;
}
