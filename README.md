<p align="center">
  <img src="apps/website/static/images/social/auto-nunes-martins-v1.png" width="480" alt="Auto Nunes Martins logo">
</p>

# Auto Nunes Martins

Public website and management platform for a used car dealership in Portugal. The website showcases the inventory, vehicle details, and promotions. The CRM manages stock, customers, sales, and day-to-day operations and finances.

[Visit the website](https://www.autonunesmartins.pt/) · [Local setup](#local-development) · [Documentation](#documentation)

## Project structure

| Area | Directory | Responsibilities |
| --- | --- | --- |
| Public website | [apps/website](apps/website) | Inventory, vehicle pages, promotions, favorites, comparisons, and contact information |
| CRM | [apps/crm](apps/crm) | Manage vehicles, customers, sales, tasks, expenses, and website content |
| Backend | [backend](backend) | Public and authenticated APIs, business logic, persistence, and image processing |
| Shared code | [shared](shared) | Types, validation, and code shared between the applications |

The website and CRM use SvelteKit, Svelte, and TypeScript. The API uses Express and Prisma, with PostgreSQL and Storage on Supabase. Clerk handles CRM authentication. The monorepo uses Yarn Workspaces.

### Finding the code for a change

- **Public website.** Start at the URL in `apps/website/src/routes`. Its page composes components from [website features](apps/website/src/lib/features). For example, the consent dialog, stored choices and Google Ads integration are together in [privacy](apps/website/src/lib/features/privacy). The homepage hero, catalogue and vehicle details each have their own directory. [SitePage](apps/website/src/lib/features/layout/SitePage.svelte) composes the shared frame and imports its scoped styles in cascade order.
- **CRM.** Start at the route under `apps/crm/src/routes/(app)`. [CRM components](apps/crm/src/lib/components) are grouped by screen or feature. Supporting code for photos, highlights, activities, filters and forms lives in the corresponding directory under [the CRM library](apps/crm/src/lib). Server-only API clients are in `lib/server`.
- **Backend.** [app.ts](backend/src/app.ts) maps HTTP paths to handlers in [routes](backend/src/routes). Public endpoints, inventory, tasks, dashboard data and website management have separate directories. Handlers call services in `src/lib/server`, business rules in `src/lib/domain` and data access in `src/lib/data`.

## Local development

You need Node.js 20 or later, Git, Yarn 4 via Corepack, and development projects in Supabase and Clerk.

```powershell
yarn install

Copy-Item backend\.env.example backend\.env
Copy-Item apps\crm\.env.example apps\crm\.env
Copy-Item apps\website\.env.example apps\website\.env
```

Fill in the local configuration using the example files. Use development services for migrations, sample data, and bucket setup. Keep credentials in local configuration files.

```powershell
yarn workspace @anm/backend prisma:migrate
yarn workspace @anm/backend prisma:seed
yarn workspace @anm/backend supabase:bucket
yarn dev
```

| Service | Local address |
| --- | --- |
| Public website | [localhost:5173](http://localhost:5173/) |
| CRM | [localhost:5174](http://localhost:5174/) |
| API | [localhost:4000](http://localhost:4000/) |

## Checks

```powershell
yarn typecheck
yarn lint
yarn test
yarn build
```

Use `yarn test:service` to verify website and CRM integration with the gateway. To start only one frontend, run `yarn dev:website` or `yarn dev:crm` with the backend running.

## Documentation

- [Render hosting and configuration](docs/render-single-service.md)
- [Public website launch checklist](docs/publication-readiness.md)
- [Main photo, image variants, and delivery policy](docs/photo-delivery-experiment.md)
- [Social sharing previews](docs/social-previews.md)
- [Documented VAT and management reporting](docs/document-vat.md)
