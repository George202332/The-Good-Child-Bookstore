# Analytics, Search Console and Bing: setup and weekly routine

## What the site does now
- Analytics is OFF for every visitor until they press "Accept analytics" on the cookie notice (worldwide).
- It is never on for /admin, /checkout, /cart, /account, /library, /login and sign-up pages. No notice is shown there and nothing is counted.
- Visitors can change their choice any time with "Cookie settings" in the footer. Choosing "No thanks" after accepting removes the Google cookies and reloads the page.
- Only the live site (Vercel environment "Production") loads Google or counts anything. On staging nothing loads, even if NEXT_PUBLIC_GA_MEASUREMENT_ID and NEXT_PUBLIC_GTM_ID are set. Staging and live numbers can never mix.
- Our own counts (admin > Website Analytics) store no names, e-mails, IP addresses, account numbers or order contents. A purchase is counted only after the server confirms the order is really PAID, and the amount comes from the order, not the browser.

## Google Analytics (GA4)
1. In Vercel, Settings > Environment Variables, add NEXT_PUBLIC_GA_MEASUREMENT_ID (looks like G-XXXXXXXXXX) for **Production**. Redeploy.
2. After accepting the notice on the live site, open GA4 > Reports > Realtime and you should see yourself.
3. If you use Google Tag Manager (NEXT_PUBLIC_GTM_ID), open the container's Admin > Container settings and switch on "Enable consent overview". Set the analytics tags to require "analytics_storage". The site starts every visit with consent denied and updates it to granted only after acceptance.

## Google Search Console
1. Go to search.google.com/search-console and sign in with the Google account that will own the site.
2. Add property > **Domain** > type your domain (no https://) > Continue.
3. Copy the TXT record Google shows. In the company where you bought the domain (or Vercel Domains, if DNS is there), add a TXT record with host "@" and that value. Wait a few minutes, press Verify.
4. Sitemaps (left menu) > type `sitemap.xml` > Submit. Status should become "Success". The book list is in child files under it; Google reads them itself.
5. Also submit `sitemap-topics.xml` if you want it listed separately.

## Bing Webmaster Tools
1. Go to bing.com/webmasters and sign in.
2. Choose **Import from Google Search Console**. Allow access. Your site and sitemap come across, nothing else to verify.
3. Check Sitemaps shows `sitemap.xml`.

## Weekly check (10 minutes, same day each week)
Search Console:
- Performance: clicks and impressions up or down compared with last week; top pages and queries.
- Pages (indexing): the number of "Not indexed" pages should not jump. Open any new reason and look at examples.
- Sitemaps: status still "Success".
- Core Web Vitals and Page experience: no new "Poor" URLs.
- Security and manual actions: both say "No issues".
Bing Webmaster: Search performance and Site scan warnings.
In our admin: Website Analytics for the last full month: top blog posts, top books, traffic sources, blog to book to sale.

## Privacy policy wording to add (edit the page in your admin)
"With your permission we use analytics cookies (Google Analytics) and our own anonymous counters to understand which pages are visited. They never include your name, e-mail address or payment details, they are off until you accept, and they are never used on checkout, account or library pages. Change your choice any time with Cookie settings in the footer."
