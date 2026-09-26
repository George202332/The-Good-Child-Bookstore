import { getPublicSiteUrl } from "@/lib/seo/site-url";

/**
 * The one branded wrapper every outgoing email is rendered inside — a
 * polished, story-book-styled header (the "GC" mark on a soft pink →
 * lavender gradient, matching the storefront's own palette in
 * app/site.css) around whatever content the calling code already
 * builds, plus a consistent footer. Applied centrally in
 * lib/email.ts's sendEmail(), so every caller — order receipts,
 * verification links, password resets, contact-form notifications,
 * in-app message alerts, and the admin mailing-list tool
 * (actions/marketing.ts) — automatically gets the same professional
 * look with zero per-caller work, and any future email does too.
 *
 * Callers keep passing a plain HTML fragment (what used to be the
 * entire email body); this just wraps it, so nothing about their
 * existing content needs to change.
 */
export function wrapEmailHtml(innerHtml: string, opts?: { unsubscribeUrl?: string }): string {
  const siteUrl = getPublicSiteUrl();
  const siteHost = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>The Good Child Bookstore</title>
  </head>
  <body style="margin:0;padding:0;background:#FFF8EF;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">The Good Child Bookstore</div>
    <div style="padding:32px 16px;background:#FFF8EF;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
        <tr>
          <td style="background:#FFFDF8;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(63,51,80,0.10);">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(135deg,#F7D8E2 0%,#DED2F5 100%);padding:30px 32px;text-align:center;">
                  <div style="display:inline-block;width:46px;height:46px;line-height:46px;border-radius:50%;background:#F4B942;color:#2E2440;font-weight:bold;font-size:17px;font-family:Georgia,'Times New Roman',serif;margin-bottom:10px;">GC</div>
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:21px;color:#2E2440;font-weight:bold;letter-spacing:0.01em;">
                    The Good Child Bookstore
                  </div>
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:12.5px;color:#493D63;font-style:italic;margin-top:3px;">
                    Stories worth growing up with
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:32px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.65;color:#2E2440;">
                  ${innerHtml}
                </td>
              </tr>
              <tr>
                <td style="padding:18px 32px 26px;border-top:1px solid rgba(63,51,80,0.12);text-align:center;font-family:Georgia,'Times New Roman',serif;">
                  <p style="margin:0 0 6px;font-size:11.5px;color:#8A7FA0;">
                    The Good Child Bookstore &middot; <a href="${siteUrl}" style="color:#8A7FA0;text-decoration:underline;">${siteHost}</a>
                  </p>
                  ${
                    opts?.unsubscribeUrl
                      ? `<p style="margin:0 0 6px;font-size:11px;color:#8A7FA0;">You're receiving this because you opted in to marketing emails from The Good Child Bookstore. <a href="${opts.unsubscribeUrl}" style="color:#8A7FA0;text-decoration:underline;">Unsubscribe</a></p>`
                      : ""
                  }
                  <p style="margin:0;font-size:11px;color:#B5A8CE;">&copy; ${year} The Good Child Bookstore. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`;
}
