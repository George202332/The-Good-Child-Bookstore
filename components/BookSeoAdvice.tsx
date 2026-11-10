"use client";

import { useEffect, useRef, useState } from "react";
import { bookSeoScore, type BookSeoInput, type BookSeoResult } from "@/lib/seo/book-seo-score";

/** Plain text of the description: the editor hands over HTML, but the score counts words, not tags. */
const plain = (h: string) => h.replace(/<\/(p|h2|h3|li)>/g, " ").replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const SETTLE_MS = 450;   // wait this long after typing stops, so the panel does not flicker
const HIGHLIGHT_MS = 2800;


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
  // The score is worked out from whatever the author has typed so far (no save, no refresh), a moment after typing stops.
  const input: BookSeoInput = { ...props, descriptionText: plain(props.descriptionText) };
  const key = JSON.stringify(input);
  const [r, setR] = useState<BookSeoResult>(() => bookSeoScore(input));
  const [shownScore, setShownScore] = useState(r.score);
  const [gains, setGains] = useState<Record<string, number>>({});
  const previous = useRef<BookSeoResult>(r);
  const shown = useRef(r.score);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = bookSeoScore(JSON.parse(key) as BookSeoInput);
      const changed: Record<string, number> = {};
      for (const c of next.checks) {
        const was = previous.current.checks.find((x) => x.id === c.id);
        if (was && was.earned !== c.earned) changed[c.id] = c.earned - was.earned;
      }
      previous.current = next;
      setR(next);
      if (Object.keys(changed).length) {
        setGains(changed);
        setTimeout(() => setGains({}), HIGHLIGHT_MS);
      }
    }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [key]);

  // The gauge number glides from the old score to the new one.
  useEffect(() => {
    const from = shown.current, to = r.score;
    if (from === to) return;
    const start = performance.now(), dur = 600;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const v = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      shown.current = v; setShownScore(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [r.score]);
  const band = BAND[r.level];
  const missing = r.checks.filter((c) => c.earned < c.worth).sort((a, b) => (b.worth - b.earned) - (a.worth - a.earned));
  const top = missing.slice(0, 3);
  const biggest = missing[0]?.id;
  const R = 52, C = 2 * Math.PI * R, arc = C * 0.75; // a three-quarter gauge
  return (
    <section className="seo-panel" aria-label="SEO score for this book">
      <style>{css}</style>
      <div className="seo-head">
        <div className="seo-gauge" role="img" aria-label={`SEO score ${r.score} out of 100, ${band.name}`}>
          <svg viewBox="0 0 130 130" width="130" height="130">
            <g transform="rotate(135 65 65)">
              <circle cx="65" cy="65" r={R} fill="none" stroke="#E7DDF3" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${arc} ${C}`} />
              <circle cx="65" cy="65" r={R} fill="none" stroke={band.colour} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(arc * shownScore) / 100} ${C}`} style={{ transition: "stroke .3s" }} />
            </g>
          </svg>
          <div className="seo-gauge-num"><strong style={{ color: band.colour }}>{shownScore}</strong><span>out of 100</span></div>
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
            <li key={c.id} className={`seo-card${c.id === biggest ? " is-biggest" : ""}${gains[c.id] !== undefined ? " is-changed" : ""}`}>
              <div className="seo-card-top">
                <span className="seo-mark" style={{ background: tone }}>{full ? "✓" : "!"}</span>
                <strong>{c.label}</strong>
                <span className="seo-pts" style={{ color: tone }}>{gains[c.id] !== undefined && <em className={`seo-gain${gains[c.id] < 0 ? " is-loss" : ""}`}>{gains[c.id] > 0 ? "+" : ""}{gains[c.id]}</em>}{c.earned} / {c.worth} pts</span>
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
.seo-card{transition:box-shadow .3s,border-color .3s,background .3s}
.seo-card.is-changed{background:#F3EDFA;border-color:#8C72D6;box-shadow:0 0 0 3px rgba(140,114,214,.28)}
.seo-gain{font-style:normal;font-weight:700;font-size:11.5px;color:#fff;background:#1f8a4c;border-radius:999px;padding:1px 7px;margin-right:6px;animation:seoPop .5s ease-out}
.seo-gain.is-loss{background:#c0392b}
@keyframes seoPop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
@media (prefers-reduced-motion:reduce){.seo-gain{animation:none}}
.seo-flag{display:inline-block;margin-top:8px;font-size:11px;font-weight:700;color:#fff;background:#8C72D6;border-radius:999px;padding:2px 10px}
.seo-disclaimer{margin:14px 0 0;font-size:12px;color:#6b5f80;border-top:1px solid #E7DDF3;padding-top:10px}
`;
