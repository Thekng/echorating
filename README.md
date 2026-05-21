# EchoRating

Performance tracking platform for agencies. Companies define metrics and daily targets, members log activity, and dashboards/leaderboards turn the data into team-level accountability.

## Features

- Multi-company workspaces with per-company memberships and a company switcher
- Role-based access control (owner, admin, manager, member) enforced in middleware and server actions
- Onboarding flow that provisions a company, departments, and starter metrics atomically
- Email + password auth via Supabase, including invitations, email verification, and password reset
- Daily logging surface for members to record metric values against department targets
- Configurable metrics with multiple data types and a Notion-style formula engine for calculated metrics
- Targets at the daily and department level, with backfill tooling for calculated metrics
- Dashboards, leaderboards, and accountability views with filters and charts
- Transactional email via Resend, with React-based templates
- In-app product tour via react-joyride

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui + Radix primitives
- Supabase (Postgres, Auth, RLS) via `@supabase/ssr`
- SWR for client data fetching
- Resend for transactional email
- ESLint 9 + Node's built-in test runner

## Project Structure

- [app/](app/) — App Router routes
  - [app/(app)/](app/%28app%29/) — authenticated product surface (dashboard, daily-log, leaderboard, accountability, settings)
  - [app/(auth)/](app/%28auth%29/) — login, signup, invite, verify-email, reset-password, select-company
  - [app/api/](app/api/) — health check, leaderboard endpoint, Resend + Supabase webhooks
- [features/](features/) — feature-scoped server actions, queries, and domain logic
- [components/](components/) — UI grouped by feature plus shared shadcn primitives in [components/ui/](components/ui/)
- [lib/](lib/) — cross-cutting utilities
  - [lib/db/](lib/db/) — application-side database utilities
  - [lib/rbac/](lib/rbac/) — roles, permissions, and route guards
  - [lib/supabase/](lib/supabase/) — server, browser, and admin clients
  - [lib/metrics/](lib/metrics/), [lib/daily-log/](lib/daily-log/), [lib/validations/](lib/validations/), [lib/time/](lib/time/), [lib/errors/](lib/errors/), [lib/constants/](lib/constants/)
- [emails/](emails/) — Resend client and React email templates
- [middleware.ts](middleware.ts) — auth + RBAC route protection
- [supabase/](supabase/) — Supabase CLI config, canonical SQL migrations, and local-db workflow
- [scripts/](scripts/) — one-off migrations and recalculation workers
- [tests/](tests/) — `unit/` and `e2e/` suites using Node's test runner

## Getting Started

Requires Node.js 20+ (scripts and tests use the experimental TypeScript flags that ship with Node 20+).

Install dependencies:

```bash
npm install
```

Create `.env.local` at the project root with the variables listed below, then start the dev server:

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Environment Variables

Set these in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (browser)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key (server-only; never exposed to the client)
- `DATABASE_URL` — Postgres connection used by scripts and server-side queries
- `RESEND_API_KEY` — Resend API key for transactional email

## Database

Canonical schema migrations live in [supabase/migrations/](supabase/migrations/). Use the Supabase CLI to apply them.

Typical workflow:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
npm run db:push
```

For local verification against the Supabase local database:

```bash
supabase start
npm run db:reset
npm run db:lint
```

The older files in `lib/db/migrations/` are retained only as historical source material during the transition. New schema changes should be created in `supabase/migrations/` with the Supabase CLI.

## Scripts

- `npm run dev` — start the local dev server
- `npm run build` — create a production build
- `npm run start` — run the production server
- `npm run lint` — run ESLint (fails on any warning)
- `npm run db:push` — apply pending `supabase/migrations` to the linked remote project
- `npm run db:push:local` — apply pending `supabase/migrations` to the local Supabase database
- `npm run db:reset` — rebuild the local Supabase database from `supabase/migrations`
- `npm run db:lint` — lint the local Supabase database schema
- `npm run db:list` — show local vs. remote Supabase migration history
- `npm run test:unit` — run unit tests in [tests/unit/](tests/unit/)
- `npm run test:e2e` — run end-to-end tests in [tests/e2e/](tests/e2e/)
- `npm run migrate:formulas:notion-v1` — migrate legacy formulas to the Notion-style engine
- `npm run backfill:calculated-metrics` — recompute calculated metrics from existing daily logs
