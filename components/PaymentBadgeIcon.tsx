import type { PaymentBadgeUrls } from "@/lib/site-settings";

/**
 * Default payment badge icons — small, original card-shaped graphics
 * that hint at each brand (via name + a brand-adjacent color) without
 * reproducing any company's actual trademarked logo artwork. These are
 * only shown until an Admin uploads a real logo image for that badge in
 * Site Settings (e.g. the official PayPal/Visa/etc. logo, if you have
 * the rights to use it) — see Footer.tsx.
 */
const BADGE_STYLES: Record<keyof PaymentBadgeUrls, { bg: string; fg: string; label: string }> = {
  mpesa: { bg: "#ffffff", fg: "#1F6B48", label: "M-Pesa" },
  mastercard: { bg: "#ffffff", fg: "#1a1a2e", label: "Mastercard" },
  visa: { bg: "#ffffff", fg: "#1a3c8f", label: "Visa" },
  amex: { bg: "#ffffff", fg: "#2e7d9a", label: "Amex" },
  verve: { bg: "#ffffff", fg: "#0f5c47", label: "Verve" },
};

export function PaymentBadgeIcon({ type, width = 52, height = 33 }: { type: keyof PaymentBadgeUrls; width?: number; height?: number }) {
  const style = BADGE_STYLES[type];
  return (
    <svg viewBox="0 0 60 38" width={width} height={height} role="img" aria-label={style.label}>
      <rect x="1" y="1" width="58" height="36" rx="5" fill={style.bg} stroke="rgba(63,51,80,0.15)" strokeWidth="1" />
      <rect x="6" y="9" width="10" height="7" rx="1.5" fill="rgba(63,51,80,0.18)" />
      {(type === "mastercard") && (
        <>
          <circle cx="24" cy="26" r="8" fill="#EB001B" opacity="0.9" />
          <circle cx="34" cy="26" r="8" fill="#F79E1B" opacity="0.9" />
        </>
      )}
      <text x="6" y="31" fontFamily="'Times New Roman', serif" fontWeight={700} fontSize={type === "mastercard" ? 8 : 9.5} fill={style.fg}>
        {style.label}
      </text>
    </svg>
  );
}
