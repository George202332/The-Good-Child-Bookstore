export function SectionHeader({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--coral)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13.5, flexShrink: 0 }}>
        {n}
      </div>
      <div>
        <h3 style={{ fontSize: 16, marginBottom: 2 }}>{title}</h3>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>{sub}</p>
      </div>
    </div>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="form-section">{children}</div>;
}
