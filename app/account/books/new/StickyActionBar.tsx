"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The action bar that stays at the bottom of the screen on a publishing form: the short status on the left, then Save Draft,
 * Publish (or Republish) and the delete button at the far right, exactly the buttons and handlers of the checklist section,
 * only kept in view. It is drawn straight into the page (a portal) so it can stay fixed, and only while its own form is the one
 * on screen (both forms stay mounted, one hidden). It respects the phone's bottom safe area; the checklist section keeps
 * empty room beneath it so the bar never sits on top of a field.
 */
export function StickyActionBar({ status, children }: { status: string; children: React.ReactNode }) {
  const marker = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- only draw into the page after it has loaded
    setMounted(true);
    const check = () => setShown(!!marker.current && marker.current.offsetParent !== null);
    check();
    const t = setInterval(check, 500);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <div ref={marker} className="action-bar-room" aria-hidden="true" />
      {mounted && shown && createPortal(
        <div className="action-bar" role="region" aria-label="Save and publish">
          <div className="action-bar-inner">
            <span className="action-bar-status" role="status">{status}</span>
            <div className="action-bar-buttons">{children}</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
