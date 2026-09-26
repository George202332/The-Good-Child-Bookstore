/** A small "?" hint next to a table column header — hover (native
 * title tooltip) explains exactly what that column means. Used on every
 * table across both the front end and the admin backend, so this is a
 * CSS class (see .col-help in site.css) rather than inline styles —
 * admin.css then overrides its color for the dark admin theme the same
 * way it overrides every other shared component scoped under
 * .admin-shell, which a plain inline `var(--ink-faint)` couldn't pick
 * up correctly on its own. */
export function ColHelp({ text }: { text: string }) {
  return (
    <span title={text} className="col-help">
      ?
    </span>
  );
}
