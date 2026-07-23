import type { MotifKind } from "@/lib/data/catalog";

/**
 * Converted from motifSvg(kind, color) (the-good-child-bookstore_54_1.html:1913-1934).
 * Renders just the inner shapes — callers wrap this in their own <svg viewBox="0 0 100 100">.
 */
export function Motif({ kind, color = "#fff" }: { kind: MotifKind; color?: string }) {
  const c = color;
  switch (kind) {
    case "sun":
      return (
        <>
          <circle cx={50} cy={50} r={20} fill={c} />
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * 45 * Math.PI) / 180;
            const x1 = 50 + 28 * Math.cos(a), y1 = 50 + 28 * Math.sin(a);
            const x2 = 50 + 40 * Math.cos(a), y2 = 50 + 40 * Math.sin(a);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={5} strokeLinecap="round" />;
          })}
        </>
      );
    case "moon":
      return (
        <>
          <path d="M60 20 A32 32 0 1 0 60 84 A24 24 0 1 1 60 20Z" fill={c} />
          <circle cx={70} cy={30} r={3} fill={c} />
          <circle cx={80} cy={45} r={2} fill={c} />
        </>
      );
    case "leaf":
      return (
        <>
          <path d="M50 15 C75 20 85 45 85 65 C60 65 40 55 35 30 C40 20 45 16 50 15Z" fill={c} />
          <path d="M50 20 C50 40 55 55 78 62" stroke="rgba(0,0,0,0.15)" strokeWidth={3} fill="none" />
        </>
      );
    case "star":
      return <path d="M50 8 L61 38 L94 38 L67 57 L78 88 L50 68 L22 88 L33 57 L6 38 L39 38Z" fill={c} />;
    case "balloon":
      return (
        <>
          <ellipse cx={50} cy={40} rx={26} ry={32} fill={c} />
          <path d="M50 72 L44 84 L56 84Z" fill={c} />
          <line x1={50} y1={84} x2={50} y2={100} stroke={c} strokeWidth={2} />
        </>
      );
    case "cat":
      return (
        <>
          <path d="M30 40 L22 18 L42 32Z" fill={c} />
          <path d="M70 40 L78 18 L58 32Z" fill={c} />
          <circle cx={50} cy={55} r={30} fill={c} />
        </>
      );
    case "fox":
      return (
        <>
          <path d="M50 30 C70 30 82 50 78 75 C70 90 55 92 50 92 C45 92 30 90 22 75 C18 50 30 30 50 30Z" fill={c} />
          <path d="M28 32 L18 12 L40 26Z" fill={c} />
          <path d="M72 32 L82 12 L60 26Z" fill={c} />
        </>
      );
    case "boat":
      return (
        <>
          <path d="M18 60 L82 60 L70 82 L30 82Z" fill={c} />
          <line x1={50} y1={15} x2={50} y2={60} stroke={c} strokeWidth={4} />
          <path d="M50 18 L78 55 L50 55Z" fill={c} />
        </>
      );
    case "rainbow":
      return (
        <>
          <path d="M15 75 A35 35 0 0 1 85 75" stroke={c} strokeWidth={9} fill="none" />
          <path d="M28 75 A22 22 0 0 1 72 75" stroke={c} strokeWidth={9} fill="none" opacity={0.6} />
        </>
      );
    case "tree":
      return (
        <>
          <circle cx={50} cy={35} r={28} fill={c} />
          <rect x={44} y={55} width={12} height={35} rx={3} fill={c} />
        </>
      );
    case "owl":
      return (
        <>
          <ellipse cx={50} cy={55} rx={32} ry={36} fill={c} />
          <circle cx={38} cy={45} r={10} fill="#fff" opacity={0.85} />
          <circle cx={62} cy={45} r={10} fill="#fff" opacity={0.85} />
          <circle cx={38} cy={45} r={4} fill={c} />
          <circle cx={62} cy={45} r={4} fill={c} />
          <path d="M50 55 L44 65 L56 65Z" fill="#F4B942" />
        </>
      );
    case "dragon":
      return (
        <>
          <path d="M20 70 Q35 30 60 35 Q85 40 80 65 Q60 55 55 70 Q45 60 20 70Z" fill={c} />
          <circle cx={70} cy={42} r={4} fill="#fff" />
        </>
      );
    case "cloud":
      return (
        <>
          <ellipse cx={35} cy={55} rx={20} ry={16} fill={c} />
          <ellipse cx={58} cy={45} rx={26} ry={22} fill={c} />
          <ellipse cx={78} cy={58} rx={16} ry={13} fill={c} />
        </>
      );
    case "umbrella":
      return (
        <>
          <path d="M15 50 A35 35 0 0 1 85 50Z" fill={c} />
          <line x1={50} y1={50} x2={50} y2={90} stroke={c} strokeWidth={4} />
          <path d="M50 90 Q58 90 58 82" stroke={c} strokeWidth={4} fill="none" />
        </>
      );
    case "train":
      return (
        <>
          <rect x={15} y={35} width={70} height={35} rx={8} fill={c} />
          <circle cx={30} cy={78} r={7} fill={c} />
          <circle cx={70} cy={78} r={7} fill={c} />
          <rect x={25} y={45} width={18} height={14} fill="#fff" opacity={0.6} />
          <rect x={55} y={45} width={18} height={14} fill="#fff" opacity={0.6} />
        </>
      );
    case "heart":
      return (
        <path
          d="M50 85 C10 60 15 25 40 25 C48 25 50 32 50 32 C50 32 52 25 60 25 C85 25 90 60 50 85Z"
          fill={c}
        />
      );
    default:
      return <path d="M50 8 L61 38 L94 38 L67 57 L78 88 L50 68 L22 88 L33 57 L6 38 L39 38Z" fill={c} />;
  }
}
