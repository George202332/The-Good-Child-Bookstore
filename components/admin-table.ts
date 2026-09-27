/**
 * Shared table header/cell styles for admin and account data tables.
 *
 * This replaces the ~16 previously-duplicated local `TH`/`TD` (or
 * `TABLE_HEAD_STYLE`/`TABLE_CELL_STYLE`) React.CSSProperties constants
 * that used to be defined independently in each table file, with
 * slightly drifting values (some used `var(--line)` for the border
 * color, others `var(--admin-border)`; padding varied between
 * 9px/10px/12px/16px). Consolidating them here means future style
 * tweaks only need to happen in one place.
 *
 * A table wanting a visually denser/looser look than the base should
 * spread these and override just the differing properties inline
 * (e.g. `{ ...TD_STYLE, padding: "12px 16px" }`) rather than defining
 * a whole new constant from scratch.
 */

export const TH_STYLE: React.CSSProperties = {
  padding: "9px 10px",
  borderBottom: "1px solid var(--line)",
  color: "var(--ink-faint)",
  fontWeight: 600,
  fontSize: 10.5,
  textTransform: "uppercase",
  letterSpacing: "0.02em",
  textAlign: "left",
  whiteSpace: "nowrap",
};

export const TD_STYLE: React.CSSProperties = {
  padding: "9px 10px",
  borderBottom: "1px solid var(--line)",
  fontSize: 12.5,
  verticalAlign: "top",
};
