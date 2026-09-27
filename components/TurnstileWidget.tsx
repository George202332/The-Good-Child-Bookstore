"use client";

import { useEffect, useId, useRef } from "react";
import Script from "next/script";

/**
 * Renders nothing (and blocks nothing) until NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * is set — see lib/turnstile.ts for the matching server-side verify and
 * .env.example for where to add the key. Used on the Reader and Author
 * signup forms.
 */
export function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerId = useId().replace(/:/g, "");
  const renderedRef = useRef(false);

  useEffect(() => {
    if (!siteKey) return;

    function render() {
      const turnstile = (window as unknown as { turnstile?: { render: (el: string | HTMLElement, opts: Record<string, unknown>) => void } }).turnstile;
      if (!turnstile || renderedRef.current) return;
      renderedRef.current = true;
      turnstile.render(`#${containerId}`, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    }

    if ((window as unknown as { turnstile?: unknown }).turnstile) {
      render();
    } else {
      const interval = setInterval(() => {
        if ((window as unknown as { turnstile?: unknown }).turnstile) {
          clearInterval(interval);
          render();
        }
      }, 200);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, containerId]);

  if (!siteKey) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div id={containerId} style={{ margin: "8px 0" }} />
    </>
  );
}
