"use client";

import { useEffect } from "react";

/** Turns dark mode on or off for the whole page right now and remembers it
 * in the cookie the page-load script reads. */
export function applyDarkMode(on: boolean) {
  try {
    document.documentElement.classList.toggle("dark-mode", on);
    document.cookie = `gcb-dark-mode=${on ? "1" : "0"}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {
    // Non-critical.
  }
}

/** Keeps the page in step with the account's saved dark-mode choice, so the
 * author account is dark on every device and after every navigation, not
 * only on the device where the toggle was flipped. Renders nothing. */
export function DarkModeSync({ dark }: { dark: boolean | null }) {
  useEffect(() => {
    if (dark === null) return;
    applyDarkMode(dark);
  }, [dark]);
  return null;
}
