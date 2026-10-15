# Auto Nunes Martins · Painel Interno

> **Website público: publicação pendente.** Consultar a [checklist de publicação](docs/publication-readiness.md) antes de avaliar prontidão. Os dados legais/contactos ainda incluem placeholders e demonstrações. Verificação manual: `node scripts/check-publication-readiness.mjs`.

Internal admin web app for a Portuguese used-car dealership. Phase 1 — single role
(ADMIN), pt-PT locale, EUR currency.

## What's in Phase 1

| Module | What it does |
| --- | --- |
| **M0 · Scaffolding + Login + Shell** | Yarn 4 workspaces, Prisma schema on Supabase Postgres, Clerk auth (with auto-provisioning on first sign-in), Tailwind v4 token system, brand DNA primitives, custom Clerk-styled login page, sidebar + topbar app shell |
| **M1 · Viaturas** | CRUD with filters/pagination/sort, authenticated backend photo optimization (Supabase Storage; 20 photos, input up to 20 MiB/24 MP, output target about 1.1 MB, maximum 2 MB), per-vehicle expense tracker with inline edit, **margin-scheme VAT (23/123) profit card**, PDF + CSV export, SOLD-state confirmation flow on expense edits |
| **M2 · Clientes** | CRUD with digit-only NIF + phone, linked-vehicles list via Sale relation, PDF + CSV export |
| **M3 · Sales** | Transactional create from Vehicle detail (flips status, sets soldDate, computes figures, emits ActivityLog), customer picker with live search, **live margin-VAT preview** during entry, sale detail with delivery, price corrections and cancellation history |
| **M4 · Tarefas** | Kanban (svelte-dnd-action) with optimistic UI, **assignee-only visibility** + "Geral" shared inbox option, recurring task spawning (MONTHLY/ANNUAL with date-fns clamp math), **Sunday cleanup of older completed tasks** (opportunistic, throttled), PDF + CSV export |
| **M5 · Dashboard** | Single `/api/dashboard` endpoint runs 7 parallel aggregates: KPIs with deltas + 6-month sparklines, 12-month sales chart (custom SVG), best sellers, stock-aged table with thumbnails, today's tasks, recent activity feed, smart alerts banner. Streamed SSR. |
| **M6 · Financeiro** | Tabs: Despesas Operacionais (CRUD with inline edit, category + date filters) + Lucro por Viatura (sortable table with totals row). PDF + CSV exports on both. |
| **M7 · Guia de Fluxo** | Static onboarding page: 4 stage cards (Financiamento / IMT / Registo / Documentação) with red chevrons, mapped to `Vehicle.pendingDocFlags` |
| **M8 · Definições** | Theme toggle, Clerk `<UserProfile />` (account/password/2FA), admin-editable `AppSetting` form for the stock-aging threshold |
| **M9 · Polish + deploy** | Branded error pages; Node/Docker preparation for Render (see docs/render-single-service.md) |

## Stack

- **Frontend**: SvelteKit 2 + Svelte 5 (runes) + TypeScript strict + Tailwind v4 + Clerk (svelte-clerk) + Superforms + Zod + pdf-lib + svelte-dnd-action
- **Backend**: Express 4 + TypeScript strict + Prisma 5 + Supabase Postgres + Supabase Storage + Clerk JWT verify + Svix webhooks + pino
- **Shared** (`@anm/types`): Zod schemas + TS types
- **Tooling**: Yarn 4 workspaces, ESLint flat config, Prettier, Vitest, Playwright

## Repo layout

```
auto-nunes-martins/
├── backend/
│   ├── Dockerfile           # same combined build; use repository-root context
│   ├── fly.toml             # historical Fly.io configuration (not current target)
│   ├── prisma/              # schema + migrations + seed
│   └── src/
│       ├── lib/data/        # repositories (Prisma)
│       ├── lib/domain/      # business logic + unit tests (VAT, recurrence, NIF, Sunday math)
│       ├── lib/server/      # service layer (transactions + ActivityLog emission)
│       ├── middleware/      # Clerk JWT + auto-provision
│       └── routes/          # Express routers
├── apps/crm/
│   ├── svelte.config.js     # Node adapter configuration
│   └── src/
│       ├── lib/components/  # brand/ + common/ + per-feature folders
│       ├── lib/server/      # api.ts + per-resource typed clients
│       ├── lib/utils/       # pt-PT formatters
│       ├── lib/stores/      # theme
│       └── routes/
│           ├── +page.svelte # login (Clerk SignIn, custom styled)
│           └── (app)/       # authenticated route group with sidebar+topbar
├── apps/website/            # independent public SvelteKit app, no Clerk
│   ├── static/              # public assets + pre-paint startup
│   └── src/                 # stand routes (including Orbit references), public API client
├── scripts/                 # independent deployment change detection
└── shared/types/            # zod schemas + ts types
```

---

## Local development

### Prerequisites

- **Node.js ≥ 20**
- **Yarn 4** via Corepack (the `packageManager` field handles versioning)
- **Git**
- **Supabase** project (free tier works)
- **Clerk** application (free tier works)
- **cloudflared** (or ngrok) for local Clerk webhook testing (optional — auto-provision works without it)

### One-time setup

```pwsh
# 1) Install deps
yarn install

# 2) Provision Supabase + Clerk (see "Production deploy" below for what each key is for)
Copy-Item backend\.env.example backend\.env
Copy-Item apps\crm\.env.example apps\crm\.env
Copy-Item apps\website\.env.example apps\website\.env
# Edit the configuration for each app; never copy CRM secrets to the website.

# 3) Run the first migration + seed
yarn workspace @anm/backend prisma:migrate     # type "init" when prompted
yarn workspace @anm/backend prisma:seed

# 4) Create the Supabase Storage bucket programmatically
yarn workspace @anm/backend supabase:bucket

# 5) Start dev
yarn dev   # website → :5173, CRM → :5174, backend → :4000
```

### Day-to-day commands

| Command | Description |
|---|---|
| `yarn dev` | Start website, CRM and backend in parallel |
| `yarn dev:website` | Public website on port 5173 |
| `yarn dev:crm` | CRM on port 5174 |
| `yarn typecheck` | Type-check all workspaces |
| `yarn lint` | Lint all workspaces |
| `yarn test` | Vitest suites in all workspaces |
| `yarn build` | Production build of both apps |
| `yarn workspace @anm/backend prisma:studio` | Open Prisma Studio against the DB |
| `yarn workspace @anm/backend check:env` | Diagnose backend env-var setup |
| `yarn workspace @anm/backend supabase:bucket` | Create the Storage bucket (idempotent) |
| `yarn workspace @anm/crm test:e2e` | CRM Playwright command (requires configured tests) |
| `yarn test:service` | Combined gateway routing and isolation tests |

---

## Production deploy

The website, CRM and backend deploy independently. Database + storage live on Supabase. See [application deployment guide](docs/application-deployment.md).

### One Docker service on Render

Website, CRM and backend stay in separate workspaces behind one Node gateway. See [the Render guide](docs/render-single-service.md) for variables, build/start, healthcheck, temporary URL access, Clerk, shutdown and validation limits. The existing Supabase database and private photo bucket stay in use. No automatic migration, DNS changes or email activation are part of startup.

Use the root Dockerfile and render.example.yaml. Website is at / and CRM at /crm/ on the temporary Render address. New photos pass backend optimization before storage; existing photos are not reprocessed. Render runtime and memory still need validation. Vercel adapters, deployment configs and generated artifacts were removed; external hosting integrations were not changed.

---

## Key domain rules (worth knowing)

### VAT formula (margin scheme)

PT used-car dealers operate under the *regime especial dos bens em segunda mão*:

```
margin     = salePrice - purchasePrice - totalVehicleExpenses
vatAmount  = margin × 23 / 123             (extracted from gross margin)
realProfit = margin - vatAmount
```

Implemented in `backend/src/lib/domain/sale.ts`, locked down by 6 unit tests.

### Recurring tasks

When a task with `recurrence != NONE` flips to DONE, a new occurrence is spawned
in the same transaction with `dueDate` shifted by `addMonths(1)` or `addYears(1)`
(date-fns clamps Jan-31 → Feb-28/29 correctly). The old task stays in DONE.

### Task visibility

Tasks are visible to a user when **assigned to them** OR **unassigned (Geral)**.
The kanban has a `Todas / Minhas / Gerais` toggle. Mutations on someone else's
task return 404 (deliberately, to avoid leaking existence).

### Sunday task purge

Every Sunday at 00:00 local time, all DONE tasks get wiped. Triggered
opportunistically on the next visit to `/tarefas` after Sunday — no cron.
Module-level `lastPurgeAt` guard prevents double-wipes within a week.

---

## Tests

```pwsh
yarn test
```

Currently:
- **8 NIF schema tests** in `shared/types`
- **21 backend domain tests**: 6 margin-scheme VAT cases, 6 recurrence shift cases (incl. leap years), 4 stock-aging, 5 Sunday-math

Playwright E2E is scaffolded but the suite is empty — the recommended first
test covers the golden path: sign in → create vehicle → upload photo → create
customer → register sale → verify dashboard KPI increments + ActivityLog row
appears.
