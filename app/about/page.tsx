import Link from "next/link";
import { Motif } from "@/components/Motif";
import { PALETTES } from "@/lib/data/catalog";
import { getPagesContent } from "@/actions/page-content";

export const dynamic = "force-dynamic";

/** Converted from aboutHTML() (the-good-child-bookstore_54_1.html:6058-6106).
 * This was never converted in the initial build — 404 in production until now.
 *
 * The hero (eyebrow/heading/intro) is now admin-editable from
 * /admin/site-settings → Page Content → About Us, the same
 * eyebrow+heading+bodyHtml pattern already used for Blog and Contact Us
 * (see lib/page-content.ts, actions/page-content.ts). The Values and
 * Shelf team sections below it stay as fixed page design (not part of
 * the admin-editable content), except the first value card, which
 * claimed titles are "read aloud by our team before" being stocked —
 * directly contradicted by this round's "the platform does not
 * actually curate or hand-pick books" and reworded to match reality. */

const VALUES = [
  { motif: "heart" as const, title: "A real editorial review", text: "Every submission is read by an actual editor before it goes live, checking age appropriateness, accurate metadata, and copyright." },
  { motif: "leaf" as const, title: "Honest age ranges", text: "We would rather undersell a book than have it arrive too scary or too babyish." },
  { motif: "owl" as const, title: "Small and slow", text: "We add a handful of new titles a month, not a hundred: quality over a wall of options." },
  { motif: "sun" as const, title: "Built for reading aloud", text: "Rhythm and page-turns matter as much as the story; we test both." },
];

const TEAM = [
  { name: "Rosalind Farr", role: "Founder & chief reader", palette: PALETTES[6] },
  { name: "Malik Osei", role: "Head of curation", palette: PALETTES[7] },
  { name: "Junko Aldana", role: "Illustration lead", palette: PALETTES[8] },
  { name: "Theo Marchetti", role: "Customer stories", palette: PALETTES[9] },
];

const VALUE_BG = ["var(--pink)", "var(--mint)", "var(--lavender)", "#FBE6B8"];

export default async function AboutPage() {
  const { about } = await getPagesContent();
  return (
    <div className="wrap">
      <div className="about-hero" style={{ paddingTop: 56 }}>
        <div>
          <span className="eyebrow">{about.eyebrow}</span>
          <h1 style={{ fontSize: 36, marginBottom: 16 }}>{about.heading}</h1>
          {about.bodyHtml ? (
            <div className="page-body-content" dangerouslySetInnerHTML={{ __html: about.bodyHtml }} />
          ) : (
            <p>{about.introText}</p>
          )}
          <Link href="/bookshelf" className="btn btn-primary" style={{ marginTop: 10 }}>Browse the bookshelf</Link>
        </div>
        <div className="about-illustration">
          <svg viewBox="0 0 100 100"><Motif kind="owl" color="#9A7EDD" /></svg>
        </div>
      </div>

      <div className="section-head" style={{ justifyContent: "center", textAlign: "center" }}>
        <div style={{ margin: "0 auto" }}><h2>What we hold onto</h2></div>
      </div>
      <div className="value-grid">
        {VALUES.map((v, i) => (
          <div className="value-card" style={{ background: VALUE_BG[i % 4] }} key={v.title}>
            <svg viewBox="0 0 100 100"><Motif kind={v.motif} color="#3F3350" /></svg>
            <h4>{v.title}</h4>
            <p>{v.text}</p>
          </div>
        ))}
      </div>

      <div className="section-head" style={{ justifyContent: "center", textAlign: "center" }}>
        <div style={{ margin: "0 auto" }}>
          <h2>The shelf team</h2>
          <p>Five people, one very full bookcase in the break room.</p>
        </div>
      </div>
      <div className="team-grid" style={{ marginBottom: 80 }}>
        {TEAM.map((t) => (
          <div className="team-card" key={t.name}>
            <div className="author-avatar" style={{ background: t.palette[1] }}>
              {t.name.split(" ").map((w) => w[0]).join("")}
            </div>
            <h4>{t.name}</h4>
            <span>{t.role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
