import Link from "next/link";

/**
 * Plain text wordmark, per explicit instruction: no icon, no uploaded
 * image, no graphics of any kind. Two lines, "GoodChild" (one word,
 * capital C) and "Bookstore", each individually letter-spread (flexbox
 * justify-content: space-between, both lines locked to the exact same
 * width) so the very first letter of each line lines up flush-left and
 * the very last letter lines up flush-right — the G of "GoodChild" sits
 * directly above the B of "Bookstore", and the final d of "GoodChild"
 * directly above the final e of "Bookstore" — rather than the two
 * lines merely being centered on each other, which only lines up their
 * midpoints, not their edges.
 *
 * Every letter gets its own color, swept as one continuous rainbow
 * (red through violet) across every letter from the G that opens line
 * one to the e that closes line two — a real per-letter gradient, not
 * a two-stop CSS background-image gradient clipped to the text (which
 * only blends between two colors) — plus a thin grey outline
 * (text-stroke) on every letter so the rainbow fill reads as
 * deliberately bold lettering rather than plain colored text.
 *
 * `logoImageUrl`/`subColor` are still accepted (existing callers pass
 * them — SiteChrome, admin site-settings) but unused; the Site Settings
 * logo upload field still exists for other branding uses, it just isn't
 * rendered in the header/footer wordmark.
 */

const LOGO_LINES = ["GoodChild", "Bookstore"];

// One continuous red→violet sweep across every actual letter in the
// lockup (spaces excluded — they're invisible, coloring them would be
// wasted steps in the sweep). Recomputed from LOGO_LINES so the count
// never drifts out of sync with the text above.
const TOTAL_LETTERS = LOGO_LINES.join("").replace(/\s/g, "").length;

function letterColor(letterIndex: number): string {
  const hue = TOTAL_LETTERS <= 1 ? 0 : (letterIndex * 300) / (TOTAL_LETTERS - 1);
  return `hsl(${hue.toFixed(0)}, 85%, 45%)`;
}

function RainbowLine({ text, startIndex }: { text: string; startIndex: number }) {
  let letterIndex = startIndex;
  return (
    <span className="logo-wordmark-line">
      {[...text].map((ch, i) => {
        if (ch === " ") {
          return (
            <span key={i} className="logo-letter-space" aria-hidden="true">
              {" "}
            </span>
          );
        }
        const color = letterColor(letterIndex);
        letterIndex += 1;
        return (
          <span
            key={i}
            style={{
              color,
              WebkitTextStroke: "0.6px var(--ink-soft, #6b6b6b)",
              textShadow: "0 0 0.5px var(--ink-soft, #6b6b6b)",
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}

export function Logo({ subColor, logoImageUrl }: { subColor?: string; logoImageUrl?: string }) {
  void subColor;
  void logoImageUrl;
  return (
    <Link href="/" className="logo logo-wordmark" aria-label="Good Child Bookstore — home">
      <RainbowLine text={LOGO_LINES[0]} startIndex={0} />
      <RainbowLine text={LOGO_LINES[1]} startIndex={LOGO_LINES[0].replace(/\s/g, "").length} />
    </Link>
  );
}
