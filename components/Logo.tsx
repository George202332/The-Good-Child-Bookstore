import Link from "next/link";

/**
 * Plain text wordmark, per explicit instruction: no icon, no uploaded
 * image, no graphics of any kind. Two lines, "Good Child" and
 * "Bookstore", each individually letter-spread (flexbox
 * justify-content: space-between, both lines locked to the exact same
 * width) so the very first letter of each line lines up flush-left and
 * the very last letter lines up flush-right — the G of "Good" sits
 * directly above the B of "Bookstore", and the final d of "Child"
 * directly above the final e of "Bookstore" — rather than the two
 * lines merely being centered on each other, which only lines up their
 * midpoints, not their edges.
 *
 * Every letter gets its own color, swept as one continuous rainbow
 * (red through violet) across all 18 letters from the G that opens
 * line one to the e that closes line two — a real per-letter gradient,
 * not a two-stop CSS background-image gradient clipped to the text
 * (which only blends between two colors).
 *
 * `logoImageUrl`/`subColor` are still accepted (existing callers pass
 * them — SiteChrome, admin site-settings) but unused; the Site Settings
 * logo upload field still exists for other branding uses, it just isn't
 * rendered in the header/footer wordmark.
 */

const LOGO_LINES = ["Good Child", "Bookstore"];

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
          <span key={i} style={{ color }}>
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
