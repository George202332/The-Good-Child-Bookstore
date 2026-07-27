/** A small "?" hint next to a table column header — hover (native
 * title tooltip) explains exactly what that column means. */
export function ColHelp({ text }: { text: string }) {
  return (
    <span
      title={text}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 13, height: 13, borderRadius: "50%", marginLeft: 5,
        border: "1px solid var(--ink-faint)", color: "var(--ink-faint)",
        fontSize: 9, fontWeight: 700, cursor: "help", flexShrink: 0,
      }}
    >
      ?
    </span>
  );
}
