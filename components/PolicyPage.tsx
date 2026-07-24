import Link from "next/link";

/** Converted from simplePolicyPageHTML() (the-good-child-bookstore_54_1.html:6109-6119). */
export function PolicyPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: { heading: string; body: string }[];
}) {
  return (
    <div className="wrap" style={{ maxWidth: 760, padding: "56px 0 60px" }}>
      <h1 style={{ fontSize: 32, marginBottom: 14 }}>{title}</h1>
      <p style={{ color: "var(--ink-soft)", fontSize: 15, lineHeight: 1.6, marginBottom: 30 }}>{intro}</p>
      {sections.map((s) => (
        <div key={s.heading}>
          <h3 style={{ fontSize: 17, margin: "26px 0 10px" }}>{s.heading}</h3>
          <p style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{s.body}</p>
        </div>
      ))}
      <p style={{ color: "var(--ink-faint)", fontSize: 12.5, marginTop: 36 }}>
        Questions? <Link href="/contact">Contact us</Link> and a real person will get back to you.
      </p>
    </div>
  );
}
