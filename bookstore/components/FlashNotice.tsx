"use client";

import { useEffect, useState } from "react";

/** A confirmation that stays visible for a few seconds, then fades away. The "?saved=" part of the address is
 * removed too, so refreshing the page does not show it again. */
export function FlashNotice({ text, seconds = 7 }: { text: string; seconds?: number }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("saved")) {
        url.searchParams.delete("saved");
        window.history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
      }
    } catch { /* the notice still shows */ }
    const t = setTimeout(() => setVisible(false), seconds * 1000);
    return () => clearTimeout(t);
  }, [seconds]);
  if (!visible) return null;
  return <div role="status" className="publish-msg is-ok" style={{ marginBottom: 14 }}>{text}</div>;
}
