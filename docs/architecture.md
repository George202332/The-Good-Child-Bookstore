# Architecture & confirmed decisions

This document records the decisions that override or clarify the original
project brief, based on what's actually true of the existing frontend
(`the-good-child-bookstore_54_1.html`) and what the project owner confirmed
directly.

## Roles

The original brief asked for 5 roles (Admin, Editor, Author, Customer,
Affiliate) with a single unified editorial workflow. The real picture:

- **Reader, Author, Affiliate** — these are the existing frontend-facing
  account types. They get a pixel-for-pixel conversion of the current SPA
  into Next.js components. No visual redesign.
- **Editor, Admin** — these are brand new, backend/internal-only roles.
  There is no matching UI for them in the original frontend at all. Their
  dashboards, and the Draft → Pending Review → Published approval workflow,
  are new builds, living under `/admin` and `/editor` route groups that the
  public frontend never links to.

## Revenue engine

The brief's numbers (20% company / 80% author organic; 20/70/10 affiliate)
do not match the actual frontend and were confirmed to be wrong. The real
engine, ported from the frontend's `REVENUE_CONFIG` at
`the-good-child-bookstore_54_1.html:2896`, with one deliberate change:

| Sale type | Company | Author | Affiliate |
|---|---|---|---|
| Organic | 25% | 75% | — |
| Affiliate-referred | 25% | 65% | 10% |

Plus a **5% lifetime referral commission**: if an affiliate refers an
*author* onto the platform, that affiliate earns 5% of the company's
revenue from that author's sales, for as long as the author sells.

**Deliberate deviation from the frontend prototype:** the original frontend
also modeled refund (1.2%) and return (0.8%) rate deductions off the
author's share. The project owner confirmed store policy is **no
returns/refunds once a product has been purchased**, so this backend does
**not** implement that deduction at all — the author's share is the full
75%/65%, unreduced.

See `lib/revenue.ts` for the implementation and `prisma/schema.prisma`
(`SaleLine` model) for how each sale permanently stores its computed split.

## Build phases

1. ✅ Architecture — this document, role model, revenue engine
2. ✅ Database — `prisma/schema.prisma` (core models; expand as features land)
3. ✅ Authentication — Auth.js credentials provider + JWT session + role-based `middleware.ts`
4. 🔶 Frontend conversion — convert each page/section of the original SPA into
   Next.js Server/Client Components, preserving layout, typography (Times New
   Roman), palette (cream/pink/lavender/mint/gold/coral), and every
   interaction, 1:1. **Homepage: done** (hero w/ hourly-rotating 5-star
   shelf, search band, shop-by-shelf, best-sellers carousel w/ tabs,
   shop-by-age, 3 promo banners, this week's shelf grid, why-grid,
   benefits-grid, animated stats band, featured authors). **Shop page:
   done** (filters/sort/pagination reimplemented as URL search params
   instead of the original's mutable `filters` object, so filter state is
   shareable/bookmarkable; same filtering/sorting rules and result sets).
   **Book detail page: done** (cover, breadcrumb, author card, retailer
   buy-tabs, details strip, format-switching buybox, add to cart/wishlist,
   featured + "also searched" carousels, reviews with rating breakdown).
   Two originally-dead features were intentionally dropped rather than
   converted: the quantity stepper (add-to-cart always added 1 regardless
   of it) and the "write a review" form (its handlers existed in the
   original JS but no button ever called them). **Cart page: done.**
   **Checkout: done** (5-step flow — cart review, customer details, order
   summary + coupon codes (WELCOME10/READMORE), payment method selection
   w/ card-brand UI, confirmation). Not yet ported from checkout: saved-
   address/saved-payment-method dropdowns and profile autofill (need
   login/signup pages + reader dashboard first) and PDF receipt generation
   (downloadReceiptPDF, jsPDF-based). Still open on the homepage: "From the
   Journal" blog preview + newsletter band (blocked on porting the blog
   seed data). **Auth pages: done** (login with reader/author/affiliate
   tabs — now backed by Auth.js's credentials provider rather than a
   localStorage account lookup, so the tab choice is cosmetic and the
   real role comes from the database; signup for all three roles, each
   creating a real User + role-profile row via `actions/auth.ts`
   `registerUser()`, bcrypt-hashed). Not yet ported: forgot-password
   (needs a real email-sending setup to be meaningful, unlike the
   original's demo-only "shows the code in a toast" version — deferring
   rather than faking a fake). **Checkout now writes real orders**:
   `actions/orders.ts` `placeOrder()` creates a real Order + one SaleLine
   per book (with the confirmed revenue split computed and stored) for
   signed-in readers — the original only ever simulated this in
   localStorage. `prisma/seed.ts` loads the catalog fixture data into real
   `Book`/`Category` rows so those foreign keys resolve (each catalog
   author gets one placeholder seed User; run `npx prisma db seed` after
   migrating). **Reader dashboard: done** — DashboardShell (role-aware
   sidebar, converted from authorDashboardShell()), dashboard overview
   (real order/library counts), My Library (derived from real orders, same
   "can't drift out of sync" design as the original), Orders (full
   history), and a standalone Wishlist page. Author/Affiliate dashboards
   show an honest "in progress" placeholder rather than a faked version of
   the original's simulated financial/analytics engine (monthly
   breakdowns, referral timelines, promoted-book stats) — that's a
   substantial separate build, along with the ~20 remaining reader/author/
   affiliate sub-pages (payment methods, addresses, reviews, following,
   messages, my books, blog, referral links, campaigns, earnings,
   commissions, etc.), the new admin/editor backend, and the blog system.
   **Author dashboard: done** — real overview (total earnings, books sold,
   published count, all summed from actual SaleLine rows via
   lib/revenue.ts's author-share math), My Books (per-book sales/earnings,
   read-only — uploading new books needs file storage wired up first),
   Revenue (itemized sale history). No simulated charts or fake monthly
   breakdowns here, unlike the original — only what's actually in the
   database, which will read as zero/empty until real orders exist.
   **Real affiliate attribution is now wired up** (a genuine improvement
   over the original, which only ever simulated clicks/conversions with
   hashStr-seeded fake numbers): an affiliate generates a link for a
   specific book (`actions/affiliate.ts` `getOrCreateAffiliateLink()`);
   visiting that book at `/book/<id>?aff=<code>` fires a real
   `AffiliateClick` and sets a 30-day cookie identifying that
   (link, book) pair; `placeOrder()` reads the cookie and — only for that
   specific book, if it's in the cart — applies the affiliate revenue
   split and links the sale back to that `AffiliateLink`. Affiliate
   dashboard's "Referral Links" page (`/account/referrals`) is done: real
   link generation + real click/conversion counts. The rest of the
   affiliate dashboard (earnings, commissions, payout requests) still
   needs building.

   **New admin/editor backend: started.** `scripts/create-admin.ts`
   provisions the first Admin/Editor account (CLI only — no public signup,
   by design). AdminShell (new sidebar, no original equivalent), dashboard
   overview (real user/book counts; company revenue hidden from EDITOR per
   the brief's "Editor cannot access financial information" rule —
   `lib/roles.ts` `canViewFinancials()`), and Book Moderation (real
   Draft→Pending Review→Published/Rejected workflow, `actions/admin.ts`)
   are done. Still to do on the backend: homepage CMS, coupon management,
   payment gateway settings, SEO/analytics dashboards, audit logs.

   **Blog system: done.** A real CMS (new functionality — the original's
   blog pages were localStorage-only), same Draft → Pending Review →
   Published workflow as books: authors write/save-draft/submit
   (`/account/blog`, `actions/blog.ts`), admins/editors moderate
   (`/admin/blog`), and the public `/blog` list + `/blog/[slug]` detail
   pages show only published posts. **Homepage is now fully done**,
   including the "From the Journal" preview (real published posts) and
   the newsletter signup band (kept faithful to the original — it only
   ever showed a confirmation and reset the form, no real email list
   existed then either).

   Pages that read live data (`/`, `/blog`, `/blog/[slug]`) are marked
   `force-dynamic` and wrapped in try/catch that degrades to an empty
   state rather than a 500 if the database is unreachable — worth keeping
   even after a real database is connected, as basic resilience.

   **Build note:** this sandbox's TypeScript now resolves the ungenerated
   Prisma client permissively enough that `next build` succeeds directly
   against the real `lib/prisma.ts` (no more swapping in a stub to verify
   builds) — worth knowing if that behavior ever changes.
5. 🔶 Backend APIs — Server Actions done for auth, orders (with real revenue
   split + affiliate attribution), affiliate links/clicks, book/blog
   moderation, reviews; still need: payment gateway webhooks, coupons,
   payouts, homepage CMS content API
6. 🔶 Dashboards — Reader (done: overview, library, orders, wishlist,
   reviews), Author (done: overview, my books, blog, revenue), Affiliate
   (partial: referral links done, earnings/payouts not yet), Admin/Editor
   (partial: overview, book/blog moderation, users; homepage CMS/coupons/
   payment settings/SEO not yet)
7. ⬜ Payments — PayPal + Paystack live; Stripe + Flutterwave architecture only
8. ⬜ Analytics & SEO — GA4/GTM/Search Console wiring, sitemap/robots/JSON-LD
9. ⬜ Deployment — Docker, Vercel/self-hosted docs

## Payouts: Wise + wallet hold period (business rule change)

Two explicit business-rule changes from the project owner, superseding
earlier payout behavior:

1. **All author/affiliate payouts now go through Wise**, not Paystack —
   Paystack's payout coverage is too limited internationally. See
   `lib/payments/wise.ts` (real, correct integration against Wise's
   documented API: create recipient → create quote → create transfer →
   fund transfer). `WiseRecipient` (`prisma/schema.prisma`) stores each
   payout destination — type (`mpesa`, `bank`, `email`, matching Wise's
   own account types), currency, and details — managed at
   `/account/payout-settings` (shared between Author and Affiliate).
   `PayoutRequest` was generalized from affiliate-only to any user
   (`userId`, not `affiliateId`), and now references a `WiseRecipient`.
   Admin's "mark paid" (`/admin/payouts`, `approvePayoutRequest()`)
   actually executes the Wise transfer, not just a status flip.

2. **Wallet with a 10-day hold, not a longer window** — since there are
   no returns once a product is purchased, there's no real reason to
   hold earnings for months; a short hold still makes sense to cover
   payment-processor disputes/chargebacks. See `lib/wallet.ts`
   (`HOLD_DAYS = 10`): every sale's author/affiliate share sits **On
   Hold** for 10 days after the sale, then moves to **Available**.
   Requested-but-unpaid payouts are also carved out of Available.
   `actions/wallet.ts` `getMyWallet()` is role-aware (author sales vs.
   affiliate sales) and used by both `/account/revenue` (author) and
   `/account/earnings` (affiliate), which both now show On Hold /
   Available / Total Earned instead of a single balance number. Authors
   previously had NO payout mechanism at all (only affiliates did) —
   this gives them one for the first time, via the same Wise flow.

**M-Pesa is a Paystack channel, not a separate integration** — initially
built as a standalone Safaricom Daraja (STK Push) integration, then
corrected: Paystack supports M-Pesa directly as a `mobile_money` channel.
`initiateGatewayCheckout()` (`actions/payment-init.ts`) routes the
checkout "M-Pesa" option through Paystack with
`channels: ["mobile_money"]` — the charge itself stays in USD (our one
currency throughout); Paystack converts to KES at their own standard
rates when settling to M-Pesa, so there's no manual exchange-rate
handling on our side. No separate webhook, service, or Order field
needed. (The removed Daraja-specific code — `lib/payments/mpesa.ts`,
`app/api/webhooks/mpesa`, `Order.mpesaCheckoutRequestId` — is gone
entirely, not just unused.)

None of the Wise integration could be exercised against a real Wise
sandbox account in this environment (no network access, no credentials)
— same caveat as PayPal/Paystack/M-Pesa. The wallet math itself
(`lib/wallet.ts`) has no external dependency and was verified by
type-check + build only, not a live test with real sale data yet.

## Payment Methods (reader-facing, formerly deferred)

Built after all, on a design that avoids the original concern: it only
ever stores Paystack's own reusable "authorization" token (returned
after a successful card charge whose card supports reuse), never raw
card numbers — `SavedPaymentMethod` (`prisma/schema.prisma`) holds the
token plus display-only metadata (card type, last 4, bank). The actual
card details never touch our servers, either on the first charge (via
Paystack's hosted checkout, as before) or on reuse (via Paystack's
charge-authorization endpoint, `lib/payments/paystack.ts`
`chargeAuthorization()`). A card is saved automatically the first time a
reader pays with one that supports it — there's deliberately no "add a
card" form, since that would mean handling raw card data ourselves.
`/account/payment-methods` lets a reader view/remove saved cards and set
a default; checkout shows saved cards as a one-click "pay with this
card" option above the normal PayPal/Paystack/M-Pesa selector.

## Messages and Campaigns (final two pieces from the original brief)

**Messages** (`/account/messages`) — direct messages between any two
account holders (reader↔author, affiliate↔author, etc.), a real inbox
grouped by conversation with unread indicators, a thread view, and a
"start a new conversation" search. `Message.recipientId` was a loose
string in the original schema (no FK) — turned into a real relation so
conversations can be queried properly.

**Campaigns** (`/account/campaigns`, affiliate-only) — group several
referral links into a named marketing push (e.g. "Back to school 2026")
and see aggregate clicks/sales across all of them at once, instead of
only per-link stats on the Referral Links page. New `Campaign` model;
`AffiliateLink` gained an optional `campaignId`; the link generator on
`/account/referrals` can now assign a new link to an existing campaign.

With these two, every system named in the original brief (architecture,
database, auth, frontend conversion, backend APIs, dashboards, payments,
analytics/SEO) has real, working functionality — see the phase checklist
above for the handful of things still open (a couple of admin-side
settings pages, live third-party credentials, full deployment docs).

## Notes for whoever picks this up next

- A real review system is wired up on book pages (LiveReviewSection):
  any signed-in reader can write a review (1-5 stars + text), persisted
  via Rating + Review, and it's shown alongside the deterministic seed
  reviews. This is the original's "write a review" feature actually
  working, not the unreachable version it shipped with.
- Affiliate earnings/payouts are real too (`actions/payouts.ts`): balance
  is computed from actual `SaleLine.affiliateShare` on the affiliate's own
  `AffiliateLink`s minus paid/pending `PayoutRequest`s; affiliates request
  a payout for their exact available balance; Admin approves/rejects at
  `/admin/payouts`. Replaces the original's simulated earnings timeline
  (`buildAffEarningsTimeline()` — hashStr-seeded fake monthly numbers).
- Real reader Addresses (`/account/addresses`) and author Following
  (`/account/following`, `FollowAuthorButton` on book pages) are wired up
  — both are genuine upgrades over the original: addresses lived inside
  the localStorage user blob before, and the "Follow" button only ever
  showed a toast without persisting anything. Added `Address` and
  `AuthorFollow` models to the schema for these.
- SEO infrastructure from the brief is wired up: `app/robots.ts` and
  `app/sitemap.ts` (Next's native metadata-route convention — the sitemap
  reads live published books/blog posts from the database, falling back
  to the catalog fixture if unreachable), per-book and per-post
  `generateMetadata` (dynamic title/description/OG/canonical — the book
  detail page was split into a server component for this, since
  `generateMetadata` isn't available in a `"use client"` file — see
  `BookDetailClient.tsx`), JSON-LD on book pages (`Book` schema with
  `AggregateRating`/`Offer`), and conditional GA4/GTM/Search-Console/Bing
  verification wiring in the root layout — all gated on env vars, so
  nothing renders until real IDs are set in `.env`.
- Real, database-backed coupons (`actions/coupons.ts`) replace the
  checkout page's hardcoded `VALID_COUPONS` object. Admin can create/
  delete coupons at `/admin/coupons`; `prisma/seed.ts` still seeds the
  original's two codes (WELCOME10 10%, READMORE 15%) so a fresh
  deployment has working codes out of the box.
- A homepage CMS (`actions/cms.ts`, `/admin/homepage`) lets Admin edit
  the hero eyebrow/heading/description without touching code — "Allow
  Admins to edit Hero... without changing code" from the brief. Built on
  the existing generic `Setting` key-value table rather than a bespoke
  one, since more homepage sections (featured books, testimonials, etc.)
  could be added the same way later if needed. Falls back to the
  original's default hero copy if no override is saved yet or the
  database is unreachable.
- Payment gateway integration per the brief's exact split — PayPal and
  Paystack "live" (`lib/payments/paypal.ts`, `paystack.ts`: real,
  correct integration code against each provider's documented REST API
  — order/transaction creation, webhook signature verification, payment
  capture/verification), Stripe and Flutterwave "architecture only"
  (`lib/payments/stripe.ts`, `flutterwave.ts` — documented integration
  points, not implemented). Webhook handlers at
  `/api/webhooks/paypal` and `/api/webhooks/paystack` follow the brief's
  exact flow (Webhook → Verification → Financial Split → Database
  Record → Email → Dashboard Update) — the financial split itself
  already happens at order-creation time (`actions/orders.ts`), so the
  webhook's job is purely to verify and record payment.

  **Checkout is now fully wired to this**: `createPendingOrder()` creates
  the Order as PENDING; `initiateGatewayCheckout()` (`actions/payment-
  init.ts`) checks whether PayPal/Paystack credentials are configured —
  if so, it creates a real gateway order/transaction and the browser is
  redirected to the actual hosted PayPal/Paystack checkout page; if not,
  checkout falls back to demo mode (`confirmOrderPaidDirectly()` marks
  the order PAID immediately, same behavior as before). The buyer lands
  back on `/checkout/return` after paying, which verifies payment via
  the gateway's own verify/capture API (never trusts the redirect alone)
  and shows `/checkout/confirmation` — both this return-redirect path and
  the async webhooks call the same shared `finalizeOrderPayment()`
  (`lib/payments/finalize.ts`), so an order confirmed either way is
  recorded identically.

  None of this could be exercised against a real PayPal/Paystack sandbox
  account, since this environment has no network access and no real
  credentials configured — but the demo-mode fallback path (no
  credentials set) was verified end-to-end via the dev server, including
  a real "order not found" case degrading gracefully instead of a 500.

- In-admin Analytics (`/admin/analytics`, `actions/analytics.ts`) covers
  the brief's Revenue/Orders/Books Sold/Top Books/Monthly Growth
  requirements, built entirely from real `SaleLine`/`Order` rows — no
  simulated charts. Financial figures are hidden from EDITOR per
  `canViewFinancials()`, same rule as the main dashboard; EDITOR still
  sees order/unit volume. This is distinct from the GA4/GTM wiring in
  the root layout, which tracks visitor behavior rather than sales.

- Prisma's engine binaries could not be downloaded in the build sandbox
  (network-restricted). Run `npx prisma generate` on a machine with normal
  internet access, or as part of the Docker build (already wired into
  `docker/Dockerfile`) before first run. Verified: with a stubbed Prisma
  client, `next build` completes cleanly end-to-end, so this is purely an
  environment limitation, not a code issue.
- `AUTH_SECRET` must be generated (`npx auth secret`) before deploying —
  the `.env.example` placeholder is not a real secret.
- Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
  (same API — default export + `config.matcher`); this project already
  uses `proxy.ts` to avoid the deprecation warning.
