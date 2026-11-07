"use client";

import { bookSeoScore, type BookSeoInput } from "@/lib/seo/book-seo-score";

/**
 * The book's SEO score inside the author's publishing screen: a gauge, a short "Top Improvements" list first, then a
 * card for EVERY element the score uses (tick or warning, points earned out of points worth, and a plain tip).
 * It never blocks publishing.
 */
const BAND = {
  good: { colour: "#1f8a4c", soft: "#E4F3EA", name: "Strong" },
  warn: { colour: "#b7791f", soft: "#FBF0D9", name: "Getting There" },
  bad: { colour: "#c0392b", soft: "#FBE6E3", name: "Needs Work" },
} as const;

export function BookSeoAdvice(props: BookSeoInput) {
  const r = bookSeoScore(props);
  const band = BAND[r.level];
  const missing = r.checks.filter((c) => c.earned < c.worth).sort((a, b) => (b.worth - b.earned) - (a.worth - a.earned));
  const top = missing.slice(0, 3);
  const biggest = missing[0]?.id;
  const R = 52, C = 2 * Math.PI * R, arc = C * 0.75; // a three-quarter gauge
  return (
    <section className="seo-panel" aria-live="polite" aria-label="SEO score for this book">
      <style>{css}</style>
      <div className="seo-head">
        <div className="seo-gauge" role="img" aria-label={`SEO score ${r.score} out of 100, ${band.name}`}>
          <svg viewBox="0 0 130 130" width="130" height="130">
            <g transform="rotate(135 65 65)">
              <circle cx="65" cy="65" r={R} fill="none" stroke="#E7DDF3" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${arc} ${C}`} />
              <circle cx="65" cy="65" r={R} fill="none" stroke={band.colour} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(arc * r.score) / 100} ${C}`} />
            </g>
          </svg>
          <div className="seo-gauge-num"><strong style={{ color: band.colour }}>{r.score}</strong><span>out of 100</span></div>
        </div>
        <div className="seo-head-text">
          <h3>SEO Score For This Book</h3>
          <span className="seo-band" style={{ background: band.soft, color: band.colour }}>{band.name}</span>
          <div className="seo-bands" aria-hidden="true">
            <span style={{ background: BAND.bad.colour }}>0 to 49</span>
            <span style={{ background: BAND.warn.colour }}>50 to 79</span>
            <span style={{ background: BAND.good.colour }}>80 to 100</span>
          </div>
        </div>
      </div>

      <div className="seo-top">
        <h4>Top Improvements</h4>
        {top.length === 0 ? <p>✓ Everything the score looks at is in good shape.</p> : (
          <ol>
            {top.map((c) => <li key={c.id}><strong>{c.label}</strong> <em>+{c.worth - c.earned} points available</em></li>)}
          </ol>
        )}
      </div>

      <h4 className="seo-sub">Every Element In The Score</h4>
      <ul className="seo-cards">
        {r.checks.map((c) => {
          const full = c.earned >= c.worth;
          const tone = full ? "#1f8a4c" : c.earned > 0 ? "#b7791f" : "#c0392b";
          return (
            <li key={c.id} className={`seo-card${c.id === biggest ? " is-biggest" : ""}`}>
              <div className="seo-card-top">
                <span className="seo-mark" style={{ background: tone }}>{full ? "✓" : "!"}</span>
                <strong>{c.label}</strong>
                <span className="seo-pts" style={{ color: tone }}>{c.earned} / {c.worth} pts</span>
              </div>
              <div className="seo-bar"><i style={{ width: `${(c.earned / c.worth) * 100}%`, background: tone }} /></div>
              <p className="seo-what">{c.what}</p>
              {!full && <p className="seo-tip"><b>Tip:</b> {c.advice}</p>}
              {c.id === biggest && <span className="seo-flag">Biggest Possible Gain</span>}
            </li>
          );
        })}
      </ul>

      <p className="seo-disclaimer">
        A high score does not guarantee any ranking in search engines. It only improves the chances that people can find your book.
        These notes never stop you from publishing.
      </p>
    </section>
  );
}

const css = `
.seo-panel{margin-top:16px;padding:18px;border-radius:14px;border:1px solid #D9CCF0;background:#FBF6EC;box-shadow:0 2px 10px rgba(46,36,64,.07)}
.seo-head{display:flex;gap:18px;align-items:center;flex-wrap:wrap}
.seo-gauge{position:relative;width:130px;height:130px;flex:none}
.seo-gauge-num{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.seo-gauge-num strong{font-size:34px;line-height:1}
.seo-gauge-num span{font-size:11px;color:#6b5f80;margin-top:2px}
.seo-head-text h3{margin:0 0 6px;font-size:18px;color:#2E2440}
.seo-band{display:inline-block;padding:3px 12px;border-radius:999px;font-weight:700;font-size:13px}
.seo-bands{display:flex;gap:4px;margin-top:10px;flex-wrap:wrap}
.seo-bands span{color:#fff;font-size:11px;padding:2px 8px;border-radius:999px}
.seo-top{margin-top:16px;padding:12px 14px;border-radius:12px;background:#2E2440;color:#F1E2C9}
.seo-top h4{margin:0 0 6px;font-size:14px;color:#F1E2C9}
.seo-top p{margin:0;font-size:13px}
.seo-top ol{margin:0;padding-left:20px;display:grid;gap:4px;font-size:13px}
.seo-top em{font-style:normal;background:#8C72D6;color:#fff;border-radius:999px;padding:1px 8px;font-size:11.5px;margin-left:6px;white-space:nowrap}
.seo-sub{margin:16px 0 8px;font-size:14px;color:#2E2440}
.seo-cards{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.seo-card{position:relative;padding:12px;border-radius:12px;background:#fff;border:1px solid #E7DDF3}
.seo-card.is-biggest{border-color:#8C72D6;box-shadow:0 0 0 2px rgba(140,114,214,.25)}
.seo-card-top{display:flex;align-items:center;gap:8px;font-size:13.5px}
.seo-mark{width:20px;height:20px;border-radius:50%;color:#fff;font-size:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex:none}
.seo-pts{margin-left:auto;font-weight:700;font-size:12.5px;white-space:nowrap}
.seo-bar{height:6px;border-radius:999px;background:#EFE8F7;margin:8px 0;overflow:hidden}
.seo-bar i{display:block;height:100%;border-radius:999px}
.seo-what{margin:0;font-size:12px;color:#6b5f80}
.seo-tip{margin:6px 0 0;font-size:12.5px;color:#2E2440}
.seo-flag{display:inline-block;margin-top:8px;font-size:11px;font-weight:700;color:#fff;background:#8C72D6;border-radius:999px;padding:2px 10px}
.seo-disclaimer{margin:14px 0 0;font-size:12px;color:#6b5f80;border-top:1px solid #E7DDF3;padding-top:10px}
`;
