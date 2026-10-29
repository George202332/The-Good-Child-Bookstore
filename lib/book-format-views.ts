/**
 * Builds the per-format tabs (eBook / Print / Audiobook) shown under ONE book in the
 * author's My Books and in the admin books table. Display only: it reads the records of
 * one title (see lib/book-groups.ts) and never changes them.
 */
import { identifierFor, snColumn, isbnColumn } from "@/lib/identifiers";

export type TabKey = "ebook" | "print" | "audiobook";

export interface FormatViewRow {
  id: string;
  status: string;
  isbn: string | null;
  hasEbook: boolean;
  hasPrint: boolean;
  hasAudiobook: boolean;
  ebookPrice: unknown;
  paperbackPrice: unknown;
  hardcoverPrice: unknown;
  audiobookPrice: unknown;
  submissionMetadata: unknown;
}

export interface PreflightView {
  status: "CHECKING" | "PASSED" | "FAILED" | "UNAVAILABLE";
  checkedAt: string | null;
  reasons: string[];
}

export interface FormatTabView {
  key: TabKey;
  label: string;
  bookId: string;
  status: string;
  details: { label: string; value: string }[];
  preflight?: PreflightView | null;
}

const LABEL: Record<TabKey, string> = { ebook: "eBook", print: "Print", audiobook: "Audiobook" };

function money(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : null;
}

export function preflightOf(meta: unknown): PreflightView | null {
  const p = (meta as { printPreflight?: { status?: string; checkedAt?: string; reasons?: unknown } } | null)?.printPreflight;
  if (!p || typeof p.status !== "string") return null;
  const status = (["CHECKING", "PASSED", "FAILED", "UNAVAILABLE"] as const).find((s) => s === p.status);
  if (!status) return null;
  return { status, checkedAt: typeof p.checkedAt === "string" ? p.checkedAt : null, reasons: Array.isArray(p.reasons) ? p.reasons.map(String) : [] };
}

function src(r: FormatViewRow) {
  const meta = r.submissionMetadata as { printIsbns?: { paperback?: string; hardcover?: string } } | null;
  return { isbn: r.isbn, hasEbook: r.hasEbook, hasAudiobook: r.hasAudiobook, hasPrint: r.hasPrint, printIsbns: meta?.printIsbns ?? null };
}

/** One tab per format that exists in the group, each from the record that sells it. */
export function formatTabsOf(group: readonly FormatViewRow[]): FormatTabView[] {
  const tabs: FormatTabView[] = [];
  const owner = (pick: (r: FormatViewRow) => boolean) => group.find(pick);

  const e = owner((r) => r.hasEbook);
  if (e) {
    const id = identifierFor(src(e), "ebook");
    tabs.push({
      key: "ebook", label: LABEL.ebook, bookId: e.id, status: e.status,
      details: [
        { label: "Price", value: money(e.ebookPrice) ?? "Not set" },
        { label: id.label, value: id.value ?? "—" },
      ],
    });
  }
  const p = owner((r) => r.hasPrint);
  if (p) {
    const pb = identifierFor(src(p), "paperback").value;
    const hc = identifierFor(src(p), "hardcover").value;
    tabs.push({
      key: "print", label: LABEL.print, bookId: p.id, status: p.status,
      details: [
        { label: "Paperback price", value: money(p.paperbackPrice) ?? "Not offered" },
        { label: "Hardcover price", value: money(p.hardcoverPrice) ?? "Not offered" },
        { label: "Paperback ISBN", value: pb ?? "ISBN pending" },
        { label: "Hardcover ISBN", value: hc ?? "ISBN pending" },
      ],
      preflight: preflightOf(p.submissionMetadata),
    });
  }
  const a = owner((r) => r.hasAudiobook);
  if (a) {
    const id = identifierFor(src(a), "audiobook");
    tabs.push({
      key: "audiobook", label: LABEL.audiobook, bookId: a.id, status: a.status,
      details: [
        { label: "Price", value: money(a.audiobookPrice) ?? "Not set" },
        { label: id.label, value: id.value ?? "—" },
      ],
    });
  }
  return tabs;
}

export function missingFormatsOf(group: readonly FormatViewRow[]): TabKey[] {
  const have = new Set(formatTabsOf(group).map((t) => t.key));
  return (["ebook", "print", "audiobook"] as TabKey[]).filter((k) => !have.has(k));
}

/** The two identifier columns of the admin table for a whole group; null = show a dash. */
export function groupIdentifierColumns(group: readonly FormatViewRow[]): { sn: string | null; isbn: string | null } {
  let sn: string | null = null;
  let isbn: string | null = null;
  for (const r of group) {
    if (!sn && (r.hasEbook || r.hasAudiobook)) sn = snColumn(src(r));
    if (!isbn && r.hasPrint) isbn = isbnColumn(src(r));
  }
  return { sn, isbn };
}
