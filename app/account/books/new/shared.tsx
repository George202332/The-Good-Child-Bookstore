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

/**
 * The subset of fields the eBook / Audiobook tab and the Print tab both
 * collect — lifted up to the parent wizard (NewBookFormTabs) so the
 * Print tab can be pre-filled with whatever the author already typed on
 * the eBook tab instead of re-typing it. EbookSubmissionForm reports its
 * current values up via an `onSharedFieldsChange` callback as the
 * author types; PrintSubmissionForm receives them back as its initial
 * values via a `prefill` prop. One-way and one-time (at mount) rather
 * than continuously two-way bound — the two tabs stay otherwise
 * independent, matching how little of the wizard's existing
 * architecture needs to change for this.
 */
export interface SharedSubmissionFields {
  title: string;
  subtitle: string;
  edition: string;
  seriesName: string;
  language: string;
  publicationDate: string;
  category: string;
  genre: string;
  ageGroup: string;
  readingLevel: string;
  authorFirstName: string;
  authorLastName: string;
  description: string;
  aiDeclaration: string;
}
