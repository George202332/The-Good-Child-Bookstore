export type SocialPlatform = "facebook" | "instagram" | "pinterest" | "youtube" | "twitter" | "tiktok";

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  pinterest: "Pinterest",
  youtube: "YouTube",
  twitter: "X (Twitter)",
  tiktok: "TikTok",
};

/**
 * Built-in fallback glyphs for the footer's 6 social media slots — simple,
 * original line-icon shapes (not any platform's actual trademarked logo
 * artwork), shown until an Admin uploads a real icon image for that slot
 * in Site Settings. The Facebook/Instagram/Pinterest/YouTube shapes are
 * the same ones the footer already used before this round; Twitter/X and
 * TikTok are new, drawn in the same plain-outline style.
 */
export function SocialIcon({ platform }: { platform: SocialPlatform }) {
  switch (platform) {
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-hidden="true">
          <path d="M13 22v-9h3l1-4h-4V6.5c0-1.1.5-2 2-2h2V.3S15.5 0 14 0c-3 0-5 1.8-5 5.2V9H6v4h3v9h4Z" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" role="img" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" />
        </svg>
      );
    case "pinterest":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" role="img" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M9 20c1-3 2-8 2-8m4-4a3 3 0 1 1-3 3c0-2 1-4 4-4" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" role="img" aria-hidden="true">
          <rect x="2" y="5" width="20" height="14" rx="3" />
          <path d="M10 9l5 3-5 3z" />
        </svg>
      );
    case "twitter":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" role="img" aria-hidden="true">
          <path d="M4 4l16 16M20 4 4 20" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" role="img" aria-hidden="true">
          <path d="M14 3v11.5a3.5 3.5 0 1 1-3-3.46" />
          <path d="M14 3a5 5 0 0 0 5 5" />
        </svg>
      );
  }
}
