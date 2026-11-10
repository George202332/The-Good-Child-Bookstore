"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { CONSENT_COOKIE, CONSENT_MAX_AGE_SECONDS, classifySource, isPrivatePath, parseConsent, type ConsentStatus } from "@/lib/analytics/policy";
import { trackEvent } from "@/lib/analytics/track";

const CHANGED = "gcb-consent-changed";

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

/**
 * The footer's "Cookie Settings" link: forgets the visitor's earlier choice so the cookie question is shown again.
 * (Google's cookies are cleared if they choose Decline this time.)
 */
export function openCookieSettings() {
  if (typeof document === "undefined") return;
  document.cookie = `${CONSENT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
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

/**
 * Cookie notice + the only place Google Analytics / Tag Manager are loaded.
 * `enabled` is decided on the server from VERCEL_ENV (true only on the live site). When false nothing loads, nothing is counted,
 * and no notice is shown, because there is nothing to consent to.
 */
export function AnalyticsConsent({ enabled, gaId, gtmId }: { enabled: boolean; gaId: string | null; gtmId: string | null }) {
  const pathname = usePathname() || "/";
  const status = useSyncExternalStore(subscribe, readStatus, () => "unset" as ConsentStatus);
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
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

  const showBanner = hydrated && !priv && status === "unset";

  const choose = (v: "granted" | "denied") => {
    const wasGranted = status === "granted";
    writeConsent(v);
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
        <div role="dialog" aria-label="Cookie choices" aria-live="polite" className="gcb-cookie">
          <style>{`
            .gcb-cookie{position:fixed;z-index:60;left:max(12px, env(safe-area-inset-left));right:max(12px, env(safe-area-inset-right));bottom:max(12px, env(safe-area-inset-bottom));max-width:320px;margin:0 auto;box-sizing:border-box;
              background:#fff;color:#2E2442;border:1px solid #e4dcf0;border-radius:18px;box-shadow:0 12px 36px rgba(46,36,66,.22);
              padding:22px 20px 18px;display:flex;flex-direction:column;gap:12px;font-family:inherit}
            .gcb-cookie-title{margin:0;font-family:Georgia,"Times New Roman",serif;font-size:19px;line-height:1.2;font-weight:700}
            .gcb-cookie-text{margin:0;font-size:14px;line-height:1.55;color:#4a3f60}
            .gcb-cookie-actions{display:flex;flex-direction:column;gap:8px;margin-top:4px}
            .gcb-cookie-actions button{min-height:44px;border-radius:999px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}
            .gcb-cookie-accept{background:#4A3868;color:#fff;border:2px solid #4A3868}
            .gcb-cookie-decline{background:#fff;color:#4A3868;border:2px solid #cdbfe3}
            @media (min-width:640px){.gcb-cookie{left:auto;right:20px;bottom:20px;margin:0}}
          `}</style>
          <h2 className="gcb-cookie-title">A Quick Cookie Question</h2>
          <p className="gcb-cookie-text">
            May we count visits to improve the bookstore? Nothing personal is collected, and it is never used at checkout or in your account.
          </p>
          <div className="gcb-cookie-actions">
            <button type="button" className="gcb-cookie-accept" onClick={() => choose("granted")}>Accept</button>
            <button type="button" className="gcb-cookie-decline" onClick={() => choose("denied")}>Decline</button>
          </div>
        </div>
      )}
    </>
  );
}
