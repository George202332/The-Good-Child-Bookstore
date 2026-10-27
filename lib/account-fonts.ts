/**
 * The curated font + size choices for the account area (reader, author and
 * backend accounts). Pure data, no database or server code, so both the
 * settings screen (client) and the server actions can share it.
 *
 * Every font here is self-hosted through the site (the @fontsource packages,
 * imported in components/AccountFontFaces.ts), so it looks the same on every
 * device and never depends on what is installed on the visitor's computer.
 * "default" means "leave the current look exactly as it is".
 */

export interface AccountFontOption {
  key: string;
  label: string;
  /** CSS font-family stack; null for the Default option. */
  stack: string | null;
  /** Short note shown under the name in the picker. */
  note: string;
}

export const ACCOUNT_FONTS: AccountFontOption[] = [
  { key: "default", label: "Default", stack: null, note: "The current look" },
  { key: "atkinson", label: "Atkinson Hyperlegible", stack: "'Atkinson Hyperlegible', Arial, sans-serif", note: "Highly readable" },
  { key: "lexend", label: "Lexend", stack: "'Lexend', Arial, sans-serif", note: "Highly readable" },
  { key: "opendyslexic", label: "OpenDyslexic", stack: "'OpenDyslexic', Arial, sans-serif", note: "Highly readable" },
  { key: "opensans", label: "Open Sans", stack: "'Open Sans', Arial, sans-serif", note: "Clean and friendly" },
  { key: "roboto", label: "Roboto", stack: "'Roboto', Arial, sans-serif", note: "Modern and neutral" },
  { key: "lato", label: "Lato", stack: "'Lato', Arial, sans-serif", note: "Warm and clear" },
  { key: "nunito", label: "Nunito", stack: "'Nunito', Arial, sans-serif", note: "Soft, rounded" },
  { key: "sourcesans", label: "Source Sans 3", stack: "'Source Sans 3', Arial, sans-serif", note: "Compact and clear" },
  { key: "inter", label: "Inter", stack: "'Inter', Arial, sans-serif", note: "Made for screens" },
  { key: "ptsans", label: "PT Sans", stack: "'PT Sans', Arial, sans-serif", note: "Simple and sturdy" },
  { key: "merriweather", label: "Merriweather", stack: "'Merriweather', Georgia, serif", note: "Readable serif" },
  { key: "lora", label: "Lora", stack: "'Lora', Georgia, serif", note: "Elegant serif" },
  { key: "notoserif", label: "Noto Serif", stack: "'Noto Serif', Georgia, serif", note: "Classic serif" },
];

export interface AccountFontSizeOption {
  key: string;
  label: string;
  /** Scale on a normal screen. */
  zoom: number;
  /** Gentler scale on phones, where there is less room. */
  zoomSmall: number;
}

export const ACCOUNT_FONT_SIZES: AccountFontSizeOption[] = [
  { key: "small", label: "Small", zoom: 0.92, zoomSmall: 0.94 },
  { key: "default", label: "Default", zoom: 1, zoomSmall: 1 },
  { key: "large", label: "Large", zoom: 1.12, zoomSmall: 1.08 },
  { key: "xlarge", label: "Extra Large", zoom: 1.25, zoomSmall: 1.15 },
];

export interface AccountAppearance {
  fontFamily: string;
  fontSize: string;
}

export const DEFAULT_APPEARANCE: AccountAppearance = { fontFamily: "default", fontSize: "default" };

export function normalizeAppearance(input: { fontFamily?: unknown; fontSize?: unknown } | null | undefined): AccountAppearance {
  const f = typeof input?.fontFamily === "string" && ACCOUNT_FONTS.some((o) => o.key === input.fontFamily) ? (input.fontFamily as string) : "default";
  const s = typeof input?.fontSize === "string" && ACCOUNT_FONT_SIZES.some((o) => o.key === input.fontSize) ? (input.fontSize as string) : "default";
  return { fontFamily: f, fontSize: s };
}

export function fontStack(key: string): string | null {
  return ACCOUNT_FONTS.find((o) => o.key === key)?.stack ?? null;
}

export function sizeOption(key: string): AccountFontSizeOption {
  return ACCOUNT_FONT_SIZES.find((o) => o.key === key) ?? ACCOUNT_FONT_SIZES[1];
}
