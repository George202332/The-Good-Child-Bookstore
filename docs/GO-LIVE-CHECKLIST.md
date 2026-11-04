# Environment, payments and go-live checklist (plain words)

Where to click: **Vercel** -> your project -> **Settings** -> **Environment Variables**. For each variable you choose which
environments it applies to: **Production** (the live site, branch `main`) and/or **Preview** (staging, branch `staging`).
The site decides test or live ONLY from which environment Vercel says it is running in. There is no switch and no mode variable.

## 1. The variable names (names only, never paste values anywhere but Vercel)

| What | Variable | Tick only |
|---|---|---|
| PayPal sandbox | `PAYPAL_SANDBOX_CLIENT_ID`, `PAYPAL_SANDBOX_SECRET_KEY`, `PAYPAL_SANDBOX_WEBHOOK_ID` | **Preview** |
| PayPal live | `PAYPAL_LIVE_CLIENT_ID`, `PAYPAL_LIVE_SECRET_KEY`, `PAYPAL_LIVE_WEBHOOK_ID` | **Production** |
| Paystack test | `PAYSTACK_TEST_PUBLIC_KEY`, `PAYSTACK_TEST_SECRET_KEY` | **Preview** |
| Paystack live | `PAYSTACK_LIVE_PUBLIC_KEY`, `PAYSTACK_LIVE_SECRET_KEY` | **Production** |
| Lulu | `LULU_CLIENT_KEY`, `LULU_CLIENT_SECRET` (plain pair, mark Sensitive) | **Both** |
| Email | `RESEND_API_KEY` (and `FROM_EMAIL`) | Both |
| Database | `DATABASE_URL` (one Production-only entry, one Preview-only entry) | one each |
| Sign-in | `AUTH_SECRET` (existing Production-only, new Preview-only) | one each |
| Scheduled checks | `CRON_SECRET` | Production |
| Optional safety | `PRODUCTION_DATABASE_ENDPOINT` (the production Neon endpoint NAME, not the password) | **Preview** |
| Optional label | `DATABASE_LABEL` (`production` / `staging`) | one each |
| May stay shared | `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_GTM_ID`, `GOOGLE_SITE_VERIFICATION` | Both |

- **Lulu base address:** not needed. Lulu has only one (live) system and the code always talks to `api.lulu.com`. The code builds the
  encoded form of the key and secret itself, at request time.
- **DIRECT_URL:** this project does not use one (only `DATABASE_URL`). If you ever add one, give it a Production entry and a Preview entry too.
- **AUTH_SECRET:** the sign-in code reads only `AUTH_SECRET`. Two entries with different values is correct; no code change is needed.
- **Safeguards:** Production with any TEST variable present (or a live variable missing) refuses payments and shows a red warning in the
  admin; customers see "Payments are temporarily unavailable...". Preview with any LIVE variable present refuses to start. The site
  never falls back to the other set. Site Health shows it and emails the alert address.

## 2. Old variables the site no longer reads

`PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`,
`PAYPAL_ENV`, `PAYSTACK_MODE`, `LULU_API_KEY`, `LULU_ENV`, `STAGING_EMAIL_SINK`, `SITE_LAUNCHED`.
**Delete them in Vercel only after** the new code is deployed and a test checkout works on staging **and** staging has been merged to main
and Production redeployed. Site Health lists any that are still present.

## 3. Webhook addresses (paths; one webhook per mode per provider)

- **Paystack** (Settings -> API Keys & Webhooks, Test/Live switch at the top). Event: `charge.success`. Paystack signs with the secret key of that mode, so there is no webhook secret to store.
  - Test: `https://<staging address>/api/webhooks/paystack`  (Paystack allows one test webhook per account)
  - Live: `https://thegoodchildbookstore.com/api/webhooks/paystack`
- **PayPal** (developer.paypal.com -> your app -> Webhooks; copy the Webhook ID it shows into the matching variable). Events: *Checkout order approved* and *Payment capture completed*.
  - Sandbox app: `https://<staging address>/api/webhooks/paypal`  -> `PAYPAL_SANDBOX_WEBHOOK_ID`
  - Live app: `https://thegoodchildbookstore.com/api/webhooks/paypal`  -> `PAYPAL_LIVE_WEBHOOK_ID`
- **Lulu** print-job status: `https://thegoodchildbookstore.com/api/webhooks/lulu` (registered by the live site; staging never registers it).

An order becomes paid only through the verified webhook, and repeats are ignored.

## 4. Order of work

1. Staging: deploy, redeploy without build cache, test login, test checkout (see the test list in the reply).
2. Neon: create a backup branch of production. Then on production run `npx prisma migrate deploy` (never `migrate reset`) BEFORE merging staging into main.
3. Merge staging into main, then redeploy Production.
4. Delete the old variables (section 2).
5. Launch: live keys on Production only; live webhooks entered in each live dashboard; one real small payment; then the one-time cleanup (only after you approve the exact list).

## 5. Rotating secrets

The staging database connection string was exposed in a photo: in Neon -> your project -> Branches -> The Good Child Bookstore Staging ->
Roles -> `neondb_owner` -> Reset password, then paste the new connection string into the **Preview** `DATABASE_URL` only and redeploy.
If the production string, any Paystack/PayPal/Lulu/Resend key or `AUTH_SECRET` also appeared anywhere, rotate those too. Rotate nothing you have not seen exposed.

## 6. Test and live figures

Staging has its own database copy, so staging test sales never touch production figures. Production cannot take test payments at all
(a test key there is refused), so before launch production Accounting holds only the old test rows copied from before the split until the
one-time cleanup. Real Lulu orders sent from staging are flagged, labelled "STAGING TEST, CANCEL", and left out of Accounting.
A cancelled Lulu order should cost nothing, but Lulu can start production quickly, so cancel promptly.
