/**
 * The server-side gate for "a print edition that fails cannot be submitted until it
 * passes". The browser's pass/fail display is only a convenience: when a print
 * edition is sent for review, the server looks up its own record of the check for
 * exactly these files and settings (PrintPreflightCheck) and refuses unless it passed.
 */

import { coverKeyFor, packageKey, type SavedPreflight, type PreflightStatus } from "@/lib/print-preflight-result";

export interface GateKeys {
  interiorFileId: string;
  coverKey: string;
  packageIds: string;
}

export interface CheckRecord {
  id: string;
  status: string;
  createdAt: Date;
  reasons: string[];
}

/** A passed check for the same interior file and cover (the package list it ran with is kept). */
export interface PassedRecord extends CheckRecord {
  packageIds: string;
}

export const PREFLIGHT_NEEDED_MESSAGE =
  "This print edition has not passed the print file check yet. Open the Print tab, wait for the check under Files to finish, fix anything it lists, and then submit again.";

/** A pass older than this is re-checked (Lulu's rules and the files may have moved on). */
export const PREFLIGHT_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;

export function decidePreflightGate(opts: {
  keys: GateKeys;
  /** The latest server record for exactly these keys, if any. */
  latest: CheckRecord | null;
  /**
   * The newest PASSED check for this author, this interior file and this cover (an exact package match is preferred),
   * whatever was checked after it. A later re-run that is still "checking", or that could not reach Lulu, must not
   * cancel a pass the author already has for the same two files.
   */
  passed?: PassedRecord | null;
  /** The result already saved on the book, if any (an edit that did not change the files). */
  saved: SavedPreflight | null;
  requirePass: boolean;
  now?: Date;
}): { ok: true; save: SavedPreflight | null } | { ok: false; error: string; save: SavedPreflight | null } {
  const now = opts.now ?? new Date();
  const toSaved = (r: CheckRecord, status: PreflightStatus): SavedPreflight => ({
    status,
    checkedAt: r.createdAt.toISOString(),
    checkId: r.id,
    interiorFileId: opts.keys.interiorFileId,
    coverKey: opts.keys.coverKey,
    packageIds: opts.keys.packageIds,
    reasons: r.reasons,
  });

  const passedFresh = opts.passed && opts.passed.status === "PASSED" && now.getTime() - opts.passed.createdAt.getTime() <= PREFLIGHT_VALIDITY_MS ? opts.passed : null;
  if (passedFresh) return { ok: true, save: { ...toSaved(passedFresh, "PASSED"), packageIds: passedFresh.packageIds } };

  const fresh = opts.latest && now.getTime() - opts.latest.createdAt.getTime() <= PREFLIGHT_VALIDITY_MS ? opts.latest : null;
  if (fresh && fresh.status === "PASSED") return { ok: true, save: toSaved(fresh, "PASSED") };

  const sameFiles =
    opts.saved &&
    opts.saved.interiorFileId === opts.keys.interiorFileId &&
    opts.saved.coverKey === opts.keys.coverKey &&
    opts.saved.packageIds === opts.keys.packageIds;
  if (sameFiles && opts.saved!.status === "PASSED") return { ok: true, save: opts.saved! };
  // A passed result stays valid for the same interior file and cover, whatever print setting was edited since.
  const sameUploads = opts.saved && opts.saved.interiorFileId === opts.keys.interiorFileId && opts.saved.coverKey === opts.keys.coverKey;
  if (sameUploads && opts.saved!.status === "PASSED") return { ok: true, save: opts.saved! };

  const save = opts.latest ? toSaved(opts.latest, opts.latest.status as PreflightStatus) : null;
  if (opts.requirePass) return { ok: false, error: PREFLIGHT_NEEDED_MESSAGE, save };
  return { ok: true, save };
}

export { coverKeyFor, packageKey };
