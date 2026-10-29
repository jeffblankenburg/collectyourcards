# Collect Your Cards — Clean Rewrite Plan

> Greenfield rebuild of collectyourcards.com on **Vercel + Supabase + Resend**.
> The old Azure app (`../collectyourcards.com`) is reference-only: we mine its schema and
> business logic, but write fresh code. Goal: fast, cheap, simple — the opposite of the
> Azure stack's idle-cost floor, hourly App Service billing, and service sprawl.

---

## 0. Prime directive — preserve the data

**The production data is the only thing that absolutely must survive this rewrite.** It is large
(literally **millions of cards**) and relational, with the hierarchy:

```
year → set → series → card → card_player_team → player/team
                         └→ user_card (a user's owned copy: serial, grade, value, location, photos)
```

Everything else (code, UI, features) is replaceable; the catalog + the owner's collection records
are not. Consequences that ripple through the whole plan:

- **Migration must be idempotent and re-runnable** — we will run it many times before cutover.
- **Migration must be verified, not assumed** — row counts, checksums, and FK integrity checks
  per table; spot-compare sampled records old-vs-new before trusting it.
- **Bulk load, not row-by-row** — at millions of rows, use Postgres `COPY` / batched inserts, not
  per-row ORM writes. Disable/rebuild indexes around the load.
- **No destructive cutover** — Azure stays read-intact until the new DB is proven and DNS is flipped.

## 1. Vision

| Concern | Old (Azure) | New (Vercel/Supabase/Resend) |
|---|---|---|
| Web/app hosting | Azure App Service (hourly, always-on) | Vercel (scales to zero, edge CDN) |
| Database | Azure SQL Server (high idle floor) | Supabase Postgres (cheap tier, pooled) |
| Auth | Custom JWT + `user_session` table | **Supabase Auth** (managed) |
| Images / files | Azure Blob Storage | Supabase Storage |
| Email | Azure Communication Services | **Resend** (react-email templates) |
| Cron / background | Azure Functions (2 jobs) | Vercel Cron + Route Handlers |
| Monitoring | OpenTelemetry + Dynatrace | Vercel Analytics + Sentry |
| Framework | Express API + React/Vite SPA (split) | **Next.js (App Router)** full-stack, one repo |
| ORM | Prisma → SQL Server | Prisma → Postgres |

**What we keep (as reference):** the domain model (~80 tables), the hard-won business logic
(card matching, achievement evaluation, seller profit math, import staging/rollback), and the
feature set. **What we shed:** Azure couplings, the Express/Vite split, accumulated schema cruft,
custom session/JWT plumbing.

## 1a. Product shape — mobile-first PWA (core principle)

The product is an **excellent Progressive Web App**, not a desktop site that happens to be
responsive. **Mobile is a first-class citizen; desktop is secondary** (good, but a progressive
enhancement of the mobile experience). Consequences that ripple through the whole plan:

- **Installable + offline-capable.** Web app manifest + service worker; cached app shell and
  read-path so the catalog/collection is usable on flaky mobile networks.
- **Push notifications are a platform feature, not just in-app toasts.** Web Push API
  (service-worker push + VAPID), wired into the notifications work (P8/P9). iOS requires an
  installed PWA for push — design the install prompt / onboarding around that.
- **Touch-first, small-bundle.** Touch-sized targets, responsive images off Supabase Storage,
  minimal client JS so mobile stays fast.
- **Acceptance bar.** Lighthouse PWA pass + mobile performance budgets are explicit acceptance
  criteria (checked in P0 and enforced through P13).

## 2. Target architecture

- **Next.js (App Router, TypeScript)** — one deployable, built **mobile-first / PWA-first**
  (manifest + service worker from P0). Server Components for catalog reads, Route Handlers
  (`app/api/*`) for mutations/webhooks/push, Server Actions where ergonomic.
- **Supabase Postgres** via **Prisma** (provider `postgresql`). Use the pooled (Supavisor)
  connection string for the app, the direct connection for migrations.
- **Supabase Auth** for identity; a `profiles` table (1:1 with `auth.users`) holds the rich
  app-side user fields (role, seller flags, bio, etc.). RLS on user-owned tables.
- **Supabase Storage** buckets: `card-images`, `user-photos`, `checklists`, `supplies`.
- **Resend** for all transactional mail; templates authored with `react-email`.
- **Vercel Cron** for the recurring jobs that used to be Azure Functions.
- **shadcn/ui + Tailwind** for the UI system (fast, consistent, owns its components).

## 3. Rough cost target

Free/low tiers cover early traffic: Vercel Hobby/Pro, Supabase Free→Pro ($25/mo), Resend
free (3k emails/mo) → $20/mo. **Caveat:** a millions-of-rows catalog plus the image library will
likely push Supabase past the free tier on database size and Storage egress — size this against
real volume in Phase 1 (DB size, index size, Storage GB + egress) before assuming a price. Even so,
the scales-to-zero compute model should beat the Azure SQL + App Service always-on floor.

## 3a. Scale target (50M+ card records)

The `card` table is expected to reach **~50,000,000 rows**, with many× that across child/metadata
tables (`user_card`, `card_player_team`, prices, etc.) — i.e. potentially **hundreds of millions of
rows** total. This is well within single-node Postgres; Supabase is managed Postgres and has no
special ceiling here. Feasibility is not the concern — **cost and discipline** are:

- **Pooling is mandatory.** App connects via Supabase pooler (Supavisor, transaction mode);
  Prisma uses the pooled URL + `pgbouncer=true`, direct URL only for migrations.
- **Index discipline.** Every hot query must hit an index — seq scans on 50M rows are fatal.
  Composite/covering indexes on hot paths; chosen deliberately (indexes cost disk + write speed).
- **Compute tier sized to working set.** Enough RAM to keep hot indexes cached → paid compute
  add-on (not free/tiny tier). Main cost lever.
- **Disk + PITR.** Plausibly tens-to-hundreds of GB with indexes; disk auto-grows but costs scale,
  and PITR restore time grows with size. Size in P1.
- **Partitioning option.** For tables that reach hundreds of millions (e.g. `user_card`, price
  history), keep declarative partitioning (by user/source/time) as a designed-in option.
- **Search may outgrow Postgres FTS.** GIN + `pg_trgm` is fine into the millions; keep the search
  layer modular so a dedicated engine (Typesense/Meilisearch) can be swapped in if needed.
- **Bulk load only.** 50M rows must load via `COPY`/batches with indexes dropped+rebuilt (see P1).

**Escape hatches if it ever outgrows single-node:** Supabase read replicas, table partitioning,
external search. Not needed at 50M, but the architecture shouldn't preclude them.

**Measured (migration spike, real data, 2025 Topps slice):** with the spike's column subset,
`card` = ~117 B/row incl. indexes and `card_player_team` = ~90 B/row. Extrapolated: the `card`
table at 50M rows ≈ **5.5 GB**, `card_player_team` at ~55M ≈ **4.6 GB**. The full schema (more
columns + more indexes) will run several× larger, so plan for a **few tens of GB** of database —
comfortably within Supabase. At Pro ($25/mo, 8 GB included) plus ~$0.125/GB/mo beyond, disk for a
tens-of-GB catalog is a few dollars/month; the real spend is the **compute add-on (RAM)** sized to
keep hot indexes cached. Conclusion: 50M is a cost-and-discipline question, not a feasibility one.

## 4. Key decisions

- **Auth migration (decided):** adopt Supabase Auth. Import existing users into `auth.users`
  with their **bcrypt** hashes (Supabase supports bcrypt import — no forced password resets).
  Map `user_id` → a stable `profiles.id`. Move verification/reset emails to Supabase + Resend SMTP.
- **Schema trim:** a clean rewrite is the moment to cut cruft. Candidates to defer or drop:
  `staging_data`, `import_recovery_point`, duplicate-detection tables, `campaign_visit`,
  redundant search-version artifacts. Decided per-table in Phase 1 (see issue).
- **Search:** drop the legacy `*_indexed`/`*_soundex` columns (a `LIKE` hack, not FTS). Use
  `pg_trgm` for entity-name search (autocomplete/fuzzy/typo-tolerant — **proven on migrated data**:
  `ken griffy jr → Ken Griffey Jr`) + `tsvector` generated columns for multi-word/notes, and a
  materialized view for the 4-table card-search join. Full design in `migration/SEARCH.md`.
  Revisit a dedicated search service only if catalog scale ever demands it.
- **Background jobs:** Vercel Cron triggers Route Handlers; long jobs (spreadsheet generation,
  eBay sync) use a queue table + incremental processing to respect function timeouts.
- **Data migration:** SQL Server → Postgres via per-domain ETL scripts (Prisma on both ends or
  CSV bulk-load), run repeatedly until a verified cutover. Blob → Supabase Storage asset copy.

## 5. Phased roadmap (→ GitHub milestones)

Each phase below maps to a milestone and an **epic issue** with a task checklist + acceptance
criteria. Phases are roughly sequential; catalog (P3) and collections (P4) are the MVP.

- **P0 — Foundations.** Next.js scaffold, Vercel link, Supabase project, Resend domain, Prisma,
  shadcn/Tailwind, CI, env management, **PWA baseline** (web app manifest + service worker,
  installable shell), mobile-first layout conventions. *Done = installable "hello world" deploys
  to Vercel, talks to Supabase, and passes a baseline Lighthouse PWA/mobile check.*
- **P1 — Data model & migration (KEYSTONE).** Port + trim the ~80-table schema to a Postgres Prisma
  schema; build a repeatable, idempotent, **verified** ETL from Azure SQL; bulk-migrate the
  millions-of-rows catalog + the owner's collection records; copy Blob assets to Storage.
  *Done = row counts + FK integrity + sampled records verified-equal in Supabase; images serve
  from Storage. This phase gates everything; do not build features on unverified data.*
- **P2 — Auth (Supabase Auth).** Signup/login/verify/reset, bcrypt user import, `profiles`, roles,
  seller flags, RLS baseline. *Done = existing users log in with old passwords.*
- **P3 — Catalog (read).** Browse sets/series/cards/players/teams, card detail, faceted search,
  images. *Done = public catalog fully browsable.*
- **P4 — Collections (MVP core).** user_card CRUD, locations, photos, favorites, lists,
  collection views, series completion. *Done = a user can manage their collection end-to-end.*
- **P5 — Bulk import.** Spreadsheet upload, column mapping, entity matching, staging, rollback.
- **P6 — Seller tools.** Sales, platforms, supplies, shipping configs, profit reporting.
- **P7 — eBay integration.** OAuth, purchase sync, sports-card detection, card matching.
- **P8 — Gamification.** Achievements engine, streaks, leaderboards, notifications (in-app +
  **Web Push** via service worker / VAPID).
- **P9 — Social.** Follows, universal comments, notifications, item subscriptions — delivered
  through the same Web Push + in-app notification channel.
- **P10 — Admin / moderation / crowdsourcing.** Admin dashboards, card-edit submissions,
  contributor trust, feedback (with GitHub issue sync), duplicate-player resolution.
- **P11 — Background jobs.** Vercel Cron: daily series update, spreadsheet generation queue,
  eBay sync. *Replaces both Azure Functions.*
- **P12 — Email (Resend).** All transactional templates in react-email; wire to auth + feedback.
- **P13 — Observability, perf & cutover.** Sentry, Vercel Analytics, rate limiting, load check,
  DNS cutover, decommission Azure. *Done = collectyourcards.com points at Vercel; Azure off.*

## 6. Risks & watch-items

- **Catalog data fidelity (TOP RISK)** — millions of cards with deep FK chains; migration must be
  idempotent, bulk-loaded, and verified (counts + checksums + FK integrity + sampled diffs).
- **Function timeouts** — import/eBay/spreadsheet jobs must be chunked for serverless limits.
- **RLS correctness** — getting row-level security right is security-critical; test per table.
- **Image volume/cost** — measure Storage size & egress early (Phase 1) to confirm cost target.
- **Scope creep** — the old app accreted a lot; resist porting features users don't use. Trim.

## 7. Cutover

Run new + old in parallel. Repeatable migration → freeze writes on Azure → final delta sync →
flip DNS → monitor → decommission Azure resources after a stability window.
