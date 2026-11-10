"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { CONSENT_COOKIE, CONSENT_MAX_AGE_SECONDS, classifySource, isPrivatePath, parseConsent, type ConsentStatus } from "@/lib/analytics/policy";
import { trackEvent } from "@/lib/analytics/track";

const CHANGED = "gcb-consent-changed";
const OPEN = "gcb-open-consent";

function subscribe(cb: () => void) {
  window.addEventListener(CHANGED, cb);
  return () => window.removeEventListener(CHANGED, cb);
}
const readStatus = (): ConsentStatus => parseConsent(document.cookie);

function writeConsent(v: "granted" | "denied") {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${v}; path=/; max-age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(CHANGED));
}

function removeGoogleCookies() {
  const host = window.location.hostname;
  const parts = host.split(".");
  const domains = [host, `.${host}`, parts.length > 2 ? `.${parts.slice(-2).join(".")}` : ""].filter(Boolean);
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0].trim();
    if (name === "_ga" || name.startsWith("_ga_") || name === "_gid" || name.startsWith("_gat")) {
      for (const d of domains) document.cookie = `${name}=; path=/; domain=${d}; max-age=0`;
      document.cookie = `${name}=; path=/; max-age=0`;
    }
  }
}

/** Opens the cookie choice again (used by the footer link). */
export function openCookieSettings() { window.dispatchEvent(new Event(OPEN)); }

/**
 * Cookie notice + the only place Google Analytics / Tag Manager are loaded.
 * `enabled` is decided on the server from VERCEL_ENV (true only on the live site). When false nothing loads, nothing is counted,
 * and no notice is shown, because there is nothing to consent to.
 */
export function AnalyticsConsent({ enabled, gaId, gtmId }: { enabled: boolean; gaId: string | null; gtmId: string | null }) {
  const pathname = usePathname() || "/";
  const status = useSyncExternalStore(subscribe, readStatus, () => "unset" as ConsentStatus);
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [reopened, setReopened] = useState(false);
  const loadedGoogle = useRef(false);

  const priv = isPrivatePath(pathname);
  const allowed = enabled && status === "granted" && !priv;
  const loadGoogle = allowed && !!(gaId || gtmId);

  useEffect(() => {
    if (loadGoogle) loadedGoogle.current = true;
  }, [loadGoogle]);

  useEffect(() => {
    (window as unknown as { __gcbAnalytics?: boolean }).__gcbAnalytics = enabled;
  }, [enabled]);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(OPEN, open);
    return () => window.removeEventListener(OPEN, open);
  }, []);

  // Tell Google, on every page, whether it may collect: yes on public pages after accepting, never on private pages.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    if (gaId) w[`ga-disable-${gaId}`] = !allowed;
    if (typeof w.gtag === "function") {
      (w.gtag as (...a: unknown[]) => void)("consent", "update", { analytics_storage: allowed ? "granted" : "denied", ad_storage: "denied" });
    }
  }, [allowed, gaId, pathname]);

  // Count a page view (our own counter) once per page, public pages only, only after accepting.
  useEffect(() => {
    if (!allowed) return;
    // The traffic source is sent only with the first page of a visit, so "visits" can be counted without tracking people.
    let source: string | undefined;
    try {
      if (!sessionStorage.getItem("gcb_src")) {
        let refHost = "";
        try { refHost = document.referrer ? new URL(document.referrer).hostname : ""; } catch { /* bad referrer */ }
        source = classifySource(refHost, window.location.hostname, new URLSearchParams(window.location.search).get("utm_medium"));
        sessionStorage.setItem("gcb_src", source);
      }
    } catch { /* storage blocked: the page view is still counted, without a source */ }
    trackEvent("page_view", { path: pathname, source });
  }, [allowed, pathname]);

  if (!enabled) return null;

  const showBanner = hydrated && !priv && (status === "unset" || reopened);

  const choose = (v: "granted" | "denied") => {
    const wasGranted = status === "granted";
    writeConsent(v);
    setReopened(false);
    if (v === "denied") {
      removeGoogleCookies();
      // Google's scripts cannot be unloaded, so a fresh page load is the only way to be sure they are gone.
      if (wasGranted && loadedGoogle.current) window.location.reload();
    }
  };

  return (
    <>
      {loadGoogle && gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`gtag('consent','update',{analytics_storage:'granted'});gtag('js',new Date());gtag('config','${gaId}',{anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});`}
          </Script>
        </>
      )}
      {loadGoogle && gtmId && (
        <Script id="gtm-init" strategy="afterInteractive">
          {`gtag('consent','update',{analytics_storage:'granted'});(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      )}
      {showBanner && (
        <div role="dialog" aria-label="Cookie choices" aria-live="polite"
          style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 9999, maxWidth: 560, margin: "0 auto", background: "#fff", color: "#2E2442", border: "1px solid #d9d2e6", borderRadius: 14, boxShadow: "0 8px 30px rgba(0,0,0,.18)", padding: "16px 18px" }}>
          <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.5 }}>
            May we count visits to improve the bookstore? This uses analytics cookies that never include your name, e-mail or payment details.
            It stays off unless you accept, and it is never used on checkout, account or library pages. You can change your mind any time from &quot;Cookie settings&quot; in the footer.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary btn-small" onClick={() => choose("granted")}>Accept analytics</button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => choose("denied")}>No thanks</button>
          </div>
        </div>
      )}
    </>
  );
}
