# Irrivio

Irrivio is a multi-company operations platform for garden maintenance businesses.
This repository contains the full monorepo for the product: a NestJS API, a Next.js web app, PostgreSQL with Drizzle, and the current documentation for the platform model.

## Product scope

The current implementation already covers the main operational areas of the product:

- Multi-company authentication with active company selection
- Company branding per tenant, including logo, favicon, and browser title
- Role-based access through `company_memberships`
- Admin and employee dashboards
- Gardens management
- Teams and company members management
- Calendar and task scheduling
- Work logs for completed work
- Product stock with unit pricing
- Stock business rules with alert thresholds and email targets
- Product usage linked to gardens and tasks
- Garden expenses
- Irrigation zones and schedules per garden
- Payments
- Quotes linked to gardens, with PDF and PNG export

## Architecture

Irrivio is a `pnpm` + `turbo` monorepo.

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

### `apps/api`

NestJS REST API with:

- JWT authentication
- refresh token cookie flow
- company-scoped authorization
- Drizzle ORM
- PostgreSQL

Main modules currently in production code:

- `auth`
- `companies`
- `company-memberships`
- `teams`
- `gardens`
- `tasks`
- `worklogs`
- `products`
- `stock-rules`
- `product-usage`
- `expenses`
- `irrigation-zones`
- `payments`
- `quotes`
- `users`

### `apps/web`

Next.js App Router frontend with:

- Tailwind CSS
- shadcn/ui
- Zustand
- TanStack Query
- React Hook Form + Zod

Main areas currently implemented in the UI:

- Login and session recovery
- Role-based sidebar and dashboards
- Calendar and task details
- Gardens with nested detail sections
- Members and teams
- Stock and stock rules
- Payments
- Quotes

## Company model

The platform is tenant-based.

- `companies` is the tenant table
- `users` is global and does not contain `company_id`
- roles live in `company_memberships`, not in `users`
- one auth user can belong to multiple companies
- the active company is selected in the web app
- company-scoped endpoints validate that the authenticated user belongs to the requested company

For business modules:

- `GET` list requests send `company_id` in the query string
- `GET` detail requests also send `company_id` in the query string
- `POST` and `PATCH` send `company_id` in the body
- `DELETE` resolves the company from the record and still validates access

## Roles

### Admin

- Full management of company-scoped business data
- Can create, update, and delete operational records for the active company

### Employee

- Read and operational access limited by module rules
- Access is restricted to companies where the user has an active membership
- Can work inside task flows, work logs, visible gardens, and product usage flows allowed to their role

## Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- Zustand
- TanStack Query
- React Hook Form
- Zod

### Backend

- NestJS 11
- TypeScript
- REST API
- Passport JWT
- cookie-parser

### Data

- PostgreSQL
- Drizzle ORM

### Tooling

- pnpm
- Turborepo
- Docker Compose
- ESLint
- Prettier

## Local URLs

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- API base URL does not use a global `/api` prefix
- PostgreSQL via Docker Compose is exposed on `localhost:5433`

## Environment

### API

Use [`apps/api/.env.example`](apps/api/.env.example) as the starting point.

Main variables:

```env
PORT=3000
WEB_ORIGIN=http://localhost:3000
DATABASE_URL=postgres://postgres:postgres@localhost:5433/floripa

JWT_ACCESS_SECRET=change_me_access_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change_me_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d
JWT_REFRESH_COOKIE_NAME=refresh_token
JWT_REFRESH_COOKIE_SECURE=false
```

Notes:

- when the API runs inside Docker Compose, the internal database host is `postgres:5432`
- when the API runs on the host machine against the Docker Compose database, use `localhost:5433`

### Web

The web app uses:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

If omitted, the current frontend already falls back to `http://localhost:3001`.

## Quick start

### Option 1: Docker Compose

This is the easiest way to boot the full stack locally.

```bash
docker compose up --build
```

This starts:

1. `workspace`
2. `postgres`
3. `migration`
4. `api`
5. `web`

After startup:

- web: `http://localhost:3000`
- api: `http://localhost:3001`

### Option 2: Run locally with pnpm

1. Install dependencies:

```bash
corepack enable
corepack prepare pnpm@10.0.0 --activate
pnpm install
```

2. Create the API env file from `apps/api/.env.example`

3. Run database migrations:

```bash
pnpm --filter api db:migrate
```

4. Optional: seed local users and default company:

```bash
pnpm --filter api db:seed:users
```

5. Start the monorepo:

```bash
pnpm dev
```

## Local seed users

The current seed script creates or refreshes the default `Floripa Jardins` company and these local users:

- Admin: `miguellbdefault@gmail.com`
- Employee: `miguellbwork@gmail.com`
- Password: `Nodeapp2107.`

Seed command:

```bash
pnpm --filter api db:seed:users
```

## Useful commands

### Root

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm typecheck
```

### API

```bash
pnpm --filter api start:dev
pnpm --filter api build
pnpm --filter api db:generate
pnpm --filter api db:migrate
pnpm --filter api db:push
pnpm --filter api db:studio
pnpm --filter api db:seed:users
```

### Web

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web lint
```

## Documentation

Detailed documentation lives in [`docs`](docs):

- [`overview.md`](docs/overview.md)
- [`project-structure-monorepo.md`](docs/project-structure-monorepo.md)
- [`technologies.md`](docs/technologies.md)
- [`database-schema.md`](docs/database-schema.md)
- [`api-endpoints.md`](docs/api-endpoints.md)
- [`company-multitenancy.md`](docs/company-multitenancy.md)
- [`Irrivio.postman_collection.json`](docs/Irrivio.postman_collection.json)
