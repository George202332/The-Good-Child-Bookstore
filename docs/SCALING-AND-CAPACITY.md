# Scaling and capacity plan (Part 3)

Figures marked (verify) come from my general knowledge of the providers' public pricing and documentation. I could not open their pricing pages from here, so please check them before you budget.

## What changed in the code
| Area | Before | Now |
|---|---|---|
| Database connections | Each page could open up to ten connections of its own | Pooled address supported (Neon "-pooler"); 5 connections per function, 15 s waits; migrations still use the direct address |
| Book list | Every visit read every book with its files, reviews and ratings | Shared for 60 seconds; the price charged at checkout is always read fresh |
| Bookshelf | The whole catalogue was sent to the browser, then searched there | The server searches and sends one page of books |
| Book page | Sent every book to the browser | Sends only related books |
| Redirect look-up | A database query on every public page request | Read once a minute per server |
| Blog reads | The page waited for a database write on every view, bots included | Counted after the page is sent; bots skipped |
| Payment webhooks | Did all follow-up work before answering Paystack/PayPal | Record the payment, answer, then do the follow-up; safe to repeat |
| After-payment failures | Waited for an admin to notice | Every 30 min a safe retry of the print job and receipt e-mail (live site) |
| Outside services | Several calls had no time limit | Time limit on all repeat-safe calls, 2 retries with waiting; payment and print-job creation are not repeated automatically |
| Abuse | Contact form and sign-up had limits | Added login, search, reviews and shipping quotes; counted across all servers |
| Errors | Default Next.js error page | Friendly error, not-found and last-resort pages |
| Site Health | Service checks | Adds database connection use, errors per hour, response times, slow queries, e-mail alert on capacity warnings |
| Database | Few indexes | Eight extra indexes for the queries the site runs most (schema change, see README) |

## Search engines are never blocked
Rate limits apply only to login, search results, reviews and shipping quotes, never to ordinary pages, sitemaps or robots.txt. Crawlers read pages, so they are never counted.

## What to set in Vercel (once, Production and Preview)
1. In Neon, open the production branch and choose **Connection string > Pooled connection**. The host contains `-pooler`. Put that in Vercel as `DATABASE_URL`. Do the same for staging with the staging branch's pooled string.
2. Do nothing for migrations: `migrate-production.ps1` and `migrate-staging.ps1` already swap `-pooler` for the direct host.
3. Keep `CRON_SECRET`, `SITE_URL` as they are. Add the new workflow file `.github/workflows/order-retry.yml` (it is in `REPO-ROOT-FILES/.github/workflows`).

## What needs Vercel Pro (or other paid plans)
- **Commercial use.** Vercel's Hobby plan is for personal, non-commercial use. A shop that takes real payments should be on Pro (verify the current terms). **Upgrade on the day you take your first real customer payment.** This is the exact point, not a traffic number.
- **Cron frequency.** On Hobby, Vercel's own cron runs at most once a day. Nothing here depends on it: the 5-minute service check and the 30-minute order retry run from GitHub Actions. On Pro you could move them to Vercel cron (verify).
- **Longer-running functions and more traffic allowances** are higher on Pro (verify the numbers). Move up earlier if Vercel Logs show 504 time-outs, or the usage page shows you near a Hobby limit.
- **Pro price:** about $20 per seat per month (verify).

## Neon (database)
- The free plan scales the database to zero when idle, so the first visit after a quiet period is slower, and it has a monthly compute allowance (verify). Move to a paid plan when you launch (the Launch plan is usage-based, roughly $5 to $20 a month for a small shop (verify)). A paid plan also gives longer backup history, which suits money records.
- The pooled address lets many short-lived functions share a small number of real connections. Watch **Database connections** on Site Health: a warning e-mail is sent at 80% use.

## Rough capacity plan (to be confirmed by the staging load test)
I cannot measure real traffic from here, so these are targets and triggers, not promises.
| Stage | Visitors | What to expect | Monthly cost (verify) |
|---|---|---|---|
| Launch | up to a few hundred a day | Hobby/Neon free would work technically; use Pro + Neon paid for the commercial-use reason | Vercel ~$20 + Neon ~$5-20 + Resend free tier to start |
| Growing | thousands a day | The 60 s book cache and pooled connections carry this; watch Site Health weekly | Same, plus Resend paid tier (~$20) once e-mails exceed the free monthly allowance |
| Busy | tens of thousands a day | Move public pages to scheduled regeneration (next step below); consider a larger Neon compute | Vercel usage fees and a bigger Neon compute (cost depends on usage) |

Triggers to act: database connections over 80%, 95% page time over 3 seconds in the load test, more than 20 errors an hour, any 504 in Vercel Logs.

## Not done in this part (and why)
- **Full-page caching of book, home and blog pages.** These pages read the visitor's country (to hide country-restricted books) and the sign-in state, so a whole-page cache could show one visitor another's view. I cached the shared data instead. Next step: split the country check from the page so the rest can be regenerated on a schedule.
- **Files through a CDN with expiring links.** Files are served through the site's own download routes after checks; I did not change file storage. Needs a look at where files are stored before changing.
- **A separate job queue service.** The retry job above covers the after-payment work without a new paid service.
- **Image format and size work** (promised in Part 1 for this part) is not done.
- **Function time-outs on the Site Health page.** Vercel does not report them to the site; check Vercel Logs for 504.
