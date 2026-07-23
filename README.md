# The Good Child Bookstore — Next.js platform

Production rebuild of the original single-file HTML/CSS/JS storefront into
one unified Next.js application (frontend + backend, one repo, one deploy).

See `docs/architecture.md` for the confirmed role model, the revenue engine
(and how it differs from early drafts of the brief), and the phase-by-phase
build plan.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Prisma · PostgreSQL ·
Auth.js · Zod · React Hook Form · Docker

## Local setup

1. `cp .env.example .env` and fill in real values (at minimum `DATABASE_URL`
   and `AUTH_SECRET`, generated via `npx auth secret`)
2. `docker compose up -d db redis` (or point `DATABASE_URL` at any Postgres)
3. `npx prisma migrate dev` — creates tables from `prisma/schema.prisma`
4. `npx prisma db seed` — loads the catalog demo data (`lib/data/catalog.ts`)
   into real `Book`/`Category` rows, so orders and dashboards have real
   foreign keys to point at
5. `npm run dev` — starts the app at http://localhost:3000
6. `npx tsx scripts/create-admin.ts you@example.com "a real password" "Your Name" ADMIN`
   — creates your first Admin (or Editor) account; these roles have no
   public signup form on purpose, see `docs/architecture.md`

## Project layout

```
app/          Next.js App Router pages, layouts, and API route handlers
components/   Shared React components (converted from the original frontend)
actions/      Server Actions (mutations: checkout, book upload, payouts...)
lib/          Framework-agnostic logic: revenue.ts, roles.ts, auth.ts, prisma.ts
middleware/   (route-level middleware.ts lives at the project root, required by Next.js)
services/     Integrations: payment gateways, email, search indexing
hooks/        Client-side React hooks
types/        Shared TypeScript types
prisma/       schema.prisma + migrations
docker/       Dockerfile
docs/         Architecture notes and setup guides
scripts/      One-off maintenance/seed scripts
tests/        Test suites
```

## Status

Phase 1-3 (architecture, database schema, auth skeleton) are done — see
`docs/architecture.md` for the full phase checklist. Frontend conversion is
next.
