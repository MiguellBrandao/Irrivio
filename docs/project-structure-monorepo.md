# Project Structure - Monorepo

This repository uses `pnpm` workspaces plus `turbo`.

## Root

```txt
Irrivio/
|- apps/
|  |- api/
|  `- web/
|- docs/
|- packages/
|  `- types/
|- docker-compose.yml
|- package.json
|- pnpm-workspace.yaml
`- turbo.json
```

## apps/api

Direct local base URL is `http://localhost:3001`.

```txt
apps/api/
|- drizzle/
|- scripts/
`- src/
   |- app.module.ts
   |- main.ts
   |- auth/
   |- common/
   |- company-memberships/
   |- companies/
   |- db/
   |- gardens/
   |- payments/
   |- product-usage/
   |- products/
   |- stock-rules/
   |- quotes/
   |- tasks/
   |- teams/
   |- users/
   `- worklogs/
```

Notes:

- Modules currently follow the NestJS pattern `controller.ts`, `service.ts`, and `dto/`.
- There is no shared repository layer per module yet.
- `companies/` is currently an internal support module used for company access checks and session payloads.
- `db/schema.ts` is the source of truth for the Drizzle schema.
- `drizzle/0005_companies_multitenancy.sql` introduces the company-scoped model.

## apps/web

```txt
apps/web/
|- app/
|  |- (private)/
|  |  |- calendar/
|  |  |- dashboard/
|  |  |- employees/
|  |  |- gardens/
|  |  |- payments/
|  |  |- quotes/
|  |  |- stock/
|  |  `- teams/
|  |- (print)/
|  |  `- quotes/
|  |- auth/
|  `- layout.tsx
|- components/
|- features/
|  |- calendar/
|  |- employees/
|  |- gardens/
|  |- payments/
|  |- quotes/
|  |- stock/
|  `- teams/
|- hooks/
`- lib/
   |- api/
   `- auth/
```

Notes:

- The web currently uses `stock` as the product feature namespace.
- `dashboard` is still lightweight, but `quotes` now has list, create, edit, and printable document flows.
- The `stock` feature now covers both product stock and stock business rules.
- The auth store keeps `companies` plus `activeCompanyId`.
- Feature API wrappers append `company_id` to company-scoped requests.

## packages/types

- Present in the workspace, but currently not used as a populated shared package.

## Docker flow

`docker-compose.yml` runs the stack in this order:

1. `workspace`
2. `postgres`
3. `migration`
4. `api`
5. `web`
