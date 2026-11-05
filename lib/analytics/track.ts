"use client";

import { isPrivatePath, parseConsent, type EventName } from "./policy";

/** Set by AnalyticsConsent from the server: true only on the live site. */
export function firstPartyEnabled(): boolean {
  return typeof window !== "undefined" && (window as unknown as { __gcbAnalytics?: boolean }).__gcbAnalytics === true;
}

export function hasConsent(): boolean {
  return typeof document !== "undefined" && parseConsent(document.cookie) === "granted";
}

const FROM_BLOG_KEY = "gcb_from_blog";
export function rememberBlogSource(slug: string) { try { sessionStorage.setItem(FROM_BLOG_KEY, slug); } catch { /* storage blocked */ } }
export function blogSource(): string | undefined { try { return sessionStorage.getItem(FROM_BLOG_KEY) || undefined; } catch { return undefined; } }

/**
 * Records one event, only when: this is the live site, the visitor accepted, and (for page views) the page is not private.
 * Funnel events (add to cart, checkout started, purchase) are counted by our own server with no cookies and no ids,
 * and are never sent to Google from private pages.
 */
export function trackEvent(name: EventName, data: Record<string, string | number | undefined> = {}) {
  if (typeof window === "undefined" || !firstPartyEnabled() || !hasConsent()) return;
  if (name === "page_view" && isPrivatePath(window.location.pathname)) return;
  const clean: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(data)) if (v !== undefined && v !== "") clean[k] = v;
  const body = JSON.stringify({ name, data: clean });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon("/api/analytics/event", new Blob([body], { type: "application/json" }))) return;
  } catch { /* fall through */ }
  fetch("/api/analytics/event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}

/** Sends a named event to Google's data layer when Google was loaded (public pages only). */
export function pushToGoogle(event: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || isPrivatePath(window.location.pathname) || !hasConsent()) return;
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };
  if (!w.dataLayer) return; // Google was not loaded (staging, not accepted, or no id set)
  if (typeof w.gtag === "function") w.gtag("event", event, params);
}
