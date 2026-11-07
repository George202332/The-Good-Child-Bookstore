/**
 * Small pictures for the Book Specifications options on the print screen. Every picture is drawn here as a plain SVG
 * (nothing is copied from any printer's site). They are a guide only: real paper, ink and finishes vary slightly in print.
 * Colour options (linen, foil) use true colour swatches; trim sizes are outlines drawn to one common scale.
 */
export type SpecKind = "trim" | "binding" | "interior" | "quality" | "paper" | "finish" | "linen" | "foil";

export const LINEN_HEX: Record<string, string> = { N: "#22345f", G: "#80848d", R: "#9c2230", B: "#1b1b1f", T: "#c9ab7f", F: "#214f39" };
export const FOIL_HEX: Record<string, string> = { G: "#D4AF37", B: "#111111", W: "#FFFFFF" };

const W = 56, H = 64; // every picture sits in the same box
const INK = "#2E2440", EDGE = "#8a7aa8";

/** The widest and tallest trim in the list is 8.5 x 11.69 in: all outlines share one scale so sizes can be compared. */
export function trimOutline(code: string): { w: number; h: number } {
  const wi = parseInt(code.slice(0, 4), 10) / 100, hi = parseInt(code.slice(5, 9), 10) / 100;
  const scale = 58 / 11.7;
  const w = Number.isFinite(wi) && wi > 0 ? wi : 6, h = Number.isFinite(hi) && hi > 0 ? hi : 9;
  return { w: Math.round(w * scale * 10) / 10, h: Math.round(h * scale * 10) / 10 };
}

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return <svg className="spec-picture" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} focusable="false">{children}</svg>;
}

const lines = (x: number, y: number, w: number, n: number, gap: number, c = "#b9b2c7") =>
  Array.from({ length: n }, (_, i) => <rect key={i} x={x} y={y + i * gap} width={i === n - 1 ? w * 0.6 : w} height="2" rx="1" fill={c} />);

export function SpecPicture({ kind, code }: { kind: SpecKind; code: string }) {
  switch (kind) {
    case "trim": {
      const o = trimOutline(code);
      return (
        <Frame label="Trim size outline, drawn to scale">
          <rect x={(W - o.w) / 2} y={H - 3 - o.h + 1} width={o.w} height={o.h} fill="#fff" stroke={INK} strokeWidth="1.6" />
          <rect x={(W - o.w) / 2 + 3} y={H - 3 - o.h + 4} width={o.w - 6} height={o.h - 6} fill="none" stroke="#cfc6e0" strokeDasharray="2 2" strokeWidth="0.8" />
        </Frame>
      );
    }
    case "binding":
      if (code === "CO") {
        return (
          <Frame label="Coil bound book">
            <rect x="14" y="8" width="34" height="48" fill="#E9E1F6" stroke={INK} strokeWidth="1.4" />
            {Array.from({ length: 8 }, (_, i) => <ellipse key={i} cx="14" cy={13 + i * 5.6} rx="5" ry="2" fill="none" stroke={EDGE} strokeWidth="1.6" />)}
            {lines(22, 18, 20, 4, 7)}
          </Frame>
        );
      }
      if (code === "LW") {
        return (
          <Frame label="Hardcover with linen wrap">
            <rect x="9" y="7" width="40" height="50" fill="#3a4a7a" stroke={INK} strokeWidth="1.4" />
            <rect x="9" y="7" width="6" height="50" fill="#2b3862" />
            <rect x="12" y="10" width="34" height="44" fill="none" stroke="#ffffff55" strokeWidth="0.8" />
            <rect x="17" y="57" width="34" height="3" fill="#fff" stroke={EDGE} strokeWidth="0.8" />
            {Array.from({ length: 8 }, (_, i) => <line key={i} x1="15" x2="49" y1={12 + i * 6} y2={12 + i * 6} stroke="#ffffff22" strokeWidth="0.8" />)}
          </Frame>
        );
      }
      return (
        <Frame label="Perfect bound paperback">
          <rect x="12" y="8" width="38" height="50" fill="#F1E2C9" stroke={INK} strokeWidth="1.4" />
          <rect x="12" y="8" width="4" height="50" fill="#d8c4a0" />
          <rect x="19" y="16" width="25" height="14" fill="#8C72D6" opacity=".8" />
          {lines(19, 36, 25, 3, 6)}
        </Frame>
      );
    case "interior":
      return code === "FC" ? (
        <Frame label="Full colour interior page">
          <rect x="11" y="6" width="34" height="48" fill="#fff" stroke={INK} strokeWidth="1.2" />
          <rect x="15" y="10" width="26" height="18" fill="#e8654f" />
          <circle cx="24" cy="19" r="5" fill="#f5c04a" /><path d="M15 28 L25 17 L33 24 L41 16 V28Z" fill="#3f9d6a" />
          {lines(15, 33, 26, 3, 5.5)}
        </Frame>
      ) : (
        <Frame label="Black and white interior page">
          <rect x="11" y="6" width="34" height="48" fill="#fff" stroke={INK} strokeWidth="1.2" />
          <rect x="15" y="10" width="26" height="18" fill="#9a9aa2" />
          <circle cx="24" cy="19" r="5" fill="#dcdce0" /><path d="M15 28 L25 17 L33 24 L41 16 V28Z" fill="#4a4a52" />
          {lines(15, 33, 26, 3, 5.5, "#8d8d96")}
        </Frame>
      );
    case "quality": {
      const premium = code === "PRE";
      return (
        <Frame label={premium ? "Premium print quality: smooth, sharp detail" : "Standard print quality"}>
          <defs><linearGradient id={`q-${code}`} x1="0" x2="1"><stop offset="0" stopColor="#8C72D6" /><stop offset="1" stopColor="#f2a65a" /></linearGradient></defs>
          {premium ? (
            <rect x="8" y="12" width="40" height="30" fill={`url(#q-${code})`} stroke={INK} strokeWidth="1.2" />
          ) : (
            <g stroke={INK} strokeWidth="1.2">
              {Array.from({ length: 5 }, (_, r) => Array.from({ length: 6 }, (_, c) => (
                <rect key={`${r}-${c}`} x={8 + c * 6.67} y={12 + r * 6} width="6.67" height="6" stroke="none" fill={`hsl(${265 - c * 8}, ${55 - r * 3}%, ${58 + c * 3}%)`} />
              )))}
              <rect x="8" y="12" width="40" height="30" fill="none" />
            </g>
          )}
          <path d={premium ? "M28 50 l1.8 4 4.2.4-3.2 2.8 1 4.2-3.8-2.2-3.8 2.2 1-4.2-3.2-2.8 4.2-.4z" : "M20 52 h16 M20 57 h10"} fill={premium ? "#d4a017" : "none"} stroke={premium ? "none" : EDGE} strokeWidth="2" strokeLinecap="round" />
        </Frame>
      );
    }
    case "paper": {
      const cream = code.includes("UC");
      const coated = code.startsWith("080");
      const tone = cream ? "#F4EAD2" : "#FFFFFF";
      return (
        <Frame label={`${cream ? "Cream" : "White"} ${coated ? "coated" : "uncoated"} paper`}>
          {[0, 1, 2].map((i) => <rect key={i} x={12 + i * 2} y={14 - i * 2 + 10} width="34" height="36" fill={tone} stroke={EDGE} strokeWidth="1" />)}
          <rect x="12" y="24" width="34" height="36" fill={tone} stroke={INK} strokeWidth="1.2" />
          {coated && <path d="M16 56 L40 28" stroke="#ffffff" strokeWidth="5" opacity=".85" strokeLinecap="round" />}
          {coated && <path d="M26 58 L44 38" stroke="#e8e2f3" strokeWidth="2" opacity=".9" strokeLinecap="round" />}
          {!coated && <g fill="#00000010">{Array.from({ length: 18 }, (_, i) => <circle key={i} cx={16 + ((i * 7) % 28)} cy={28 + ((i * 11) % 28)} r="0.8" />)}</g>}
        </Frame>
      );
    }
    case "finish": {
      const gloss = code === "G";
      return (
        <Frame label={gloss ? "Gloss cover finish" : "Matte cover finish"}>
          <rect x="11" y="7" width="36" height="50" fill="#5a4a8a" stroke={INK} strokeWidth="1.4" />
          <rect x="16" y="14" width="26" height="14" fill="#F1E2C9" opacity=".9" />
          {gloss ? (
            <>
              <path d="M11 40 L47 8 V20 L11 52Z" fill="#fff" opacity=".35" />
              <path d="M22 57 L47 34 V40 L28 57Z" fill="#fff" opacity=".22" />
            </>
          ) : (
            <g fill="#ffffff14">{Array.from({ length: 24 }, (_, i) => <circle key={i} cx={14 + ((i * 9) % 30)} cy={10 + ((i * 13) % 44)} r="1" />)}</g>
          )}
        </Frame>
      );
    }
    case "linen": {
      const c = LINEN_HEX[code] ?? "#777";
      const id = `ln-${code}`;
      return (
        <Frame label="Linen wrap colour swatch">
          <defs><pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0H4M0 2H4" stroke="#ffffff" strokeOpacity=".16" strokeWidth=".8" /><path d="M0 0V4M2 0V4" stroke="#000" strokeOpacity=".14" strokeWidth=".8" /></pattern></defs>
          <rect x="9" y="12" width="38" height="40" rx="4" fill={c} stroke={INK} strokeWidth="1.2" />
          <rect x="9" y="12" width="38" height="40" rx="4" fill={`url(#${id})`} />
        </Frame>
      );
    }
    case "foil": {
      const c = FOIL_HEX[code] ?? "#D4AF37";
      const gold = code === "G";
      return (
        <Frame label="Foil stamp colour swatch">
          <defs><linearGradient id={`fo-${code}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={gold ? "#f6e08c" : c} /><stop offset=".5" stopColor={c} /><stop offset="1" stopColor={gold ? "#a8821d" : c} /></linearGradient></defs>
          <rect x="9" y="12" width="38" height="40" rx="4" fill="#22345f" stroke={INK} strokeWidth="1.2" />
          <text x="28" y="40" textAnchor="middle" fontSize="20" fontWeight="700" fontFamily="Georgia, 'Times New Roman', serif" fill={`url(#fo-${code})`} stroke={code === "W" ? "none" : "none"}>Aa</text>
        </Frame>
      );
    }
  }
}
