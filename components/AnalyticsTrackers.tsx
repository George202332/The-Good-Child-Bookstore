"use client";

import { useEffect, type ReactNode } from "react";
import { blogSource, pushToGoogle, rememberBlogSource, trackEvent } from "@/lib/analytics/track";
import { isBookPath } from "@/lib/analytics/policy";

/** Counts one book-page view (after the visitor accepted analytics). Renders nothing. */
export function BookViewTracker({ bookId }: { bookId: string }) {
  useEffect(() => {
    let source: string | undefined;
    try { source = sessionStorage.getItem("gcb_src") || undefined; } catch { /* blocked */ }
    trackEvent("book_view", { bookId, blogSlug: blogSource(), source });
    pushToGoogle("view_item", { item_id: bookId });
  }, [bookId]);
  return null;
}

/** Counts a purchase once, for a confirmed-paid order. The server re-checks the order and uses its real total. */
export function PurchaseTracker({ orderId }: { orderId: string }) {
  useEffect(() => {
    let done = false;
    try { done = sessionStorage.getItem(`gcb_purchase_${orderId}`) === "1"; } catch { /* blocked */ }
    if (done) return;
    trackEvent("purchase", { orderId, blogSlug: blogSource() });
    try { sessionStorage.setItem(`gcb_purchase_${orderId}`, "1"); } catch { /* blocked */ }
  }, [orderId]);
  return null;
}

/** Counts that checkout was opened (once per visit to the page). Never sends anything to Google. */
export function CheckoutStartedTracker({ bookIds }: { bookIds: string[] }) {
  const key = bookIds.join(",");
  useEffect(() => {
    if (!key) return;
    trackEvent("checkout_started", { items: bookIds.length, bookIds: key, blogSlug: blogSource() });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires when the set of books changes
  }, [key]);
  return null;
}

/**
 * Wraps a blog post. When a reader clicks a link from the post to a book, remembers which post sent them
 * (for this browser tab only) and counts a "blog to book" click.
 */
export function BlogClickTracker({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <div
      onClickCapture={(e) => {
        const a = (e.target as HTMLElement | null)?.closest?.("a");
        const href = a?.getAttribute("href") || "";
        if (!href.startsWith("/") || !isBookPath(href)) return;
        rememberBlogSource(slug);
        trackEvent("blog_to_book", { blogSlug: slug, target: href.split("?")[0] });
      }}
    >
      {children}
    </div>
  );
}
