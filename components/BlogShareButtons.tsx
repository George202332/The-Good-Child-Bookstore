"use client";

import { useState } from "react";

/** Real share buttons — copies the current page URL to the clipboard,
 * and opens real share-intent links for X/Facebook (the original only
 * had a placeholder "Sharing coming soon!" toast for these two). */
export function BlogShareButtons() {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser — fail silently
      // rather than showing a confusing error for a non-critical action.
    }
  }

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="blog-share-row">
      <a
        className="blog-share-btn"
        title="Share on X"
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.6 8.7L23.3 22h-7l-5.5-7-6.3 7H1.4l8.1-9.3L1 2h7.2l5 6.6Zm-1.2 18h1.7L6.4 4H4.6Z" /></svg>
      </a>
      <a
        className="blog-share-btn"
        title="Share on Facebook"
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 22v-9h3l1-4h-4V6.5c0-1.1.5-2 2-2h2V.3S15.5 0 14 0c-3 0-5 1.8-5 5.2V9H6v4h3v9h4Z" /></svg>
      </a>
      <button type="button" className="blog-share-btn" title="Copy link" onClick={copyLink}>
        {copied ? (
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" /></svg>
        )}
      </button>
    </div>
  );
}
