# EasyPanel Deployment

This project should be deployed to EasyPanel as separate services.

## Recommended services

Create these services inside the same EasyPanel project:

1. `postgres`: use a managed `Postgres Service`
2. `api`: use an `App Service` with [`apps/api/Dockerfile`](../apps/api/Dockerfile)
3. `web`: use an `App Service` with [`apps/web/Dockerfile`](../apps/web/Dockerfile)
4. `api-migrate`: use a one-off/manual service with [`apps/api/Dockerfile.migrate`](../apps/api/Dockerfile.migrate)

Do not deploy the local `workspace` service from `docker-compose.yml`. It only exists for local development.

## Why separate services

- `web` and `api` are different Node processes with different ports and restart cycles.
- `postgres` should stay isolated from the application containers.
- database migrations should run independently from the long-running API container.

## Build source

Use the repository root as the build context and point each EasyPanel service to the correct Dockerfile:

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `apps/api/Dockerfile.migrate`

The root [`.dockerignore`](../.dockerignore) keeps the build context small.

## Environment variables

### `postgres`

Create the database with the normal EasyPanel `Postgres Service` flow.

### `api`

Recommended environment variables:

```env
PORT=3000
WEB_ORIGIN=https://app.example.com
DATABASE_URL=postgres://USER:PASSWORD@POSTGRES_HOST:5432/floripa

JWT_ACCESS_SECRET=change_me_access_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change_me_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d
JWT_REFRESH_COOKIE_NAME=refresh_token
JWT_REFRESH_COOKIE_SECURE=true
```

Notes:

- set `WEB_ORIGIN` to the public URL of the web service
- use the internal host/credentials exposed by the EasyPanel Postgres service
- keep the API on port `3000` inside the container

### `web`

Recommended environment variables:

```env
NEXT_PUBLIC_API_URL=https://api.example.com
PORT=3000
HOSTNAME=0.0.0.0
```

`NEXT_PUBLIC_API_URL` must point to the public API domain because the frontend performs browser-side requests. In this project it also needs to be present during the image build, not only at runtime.

## Domains

Use subdomains under the same root domain:

- web: `https://app.example.com`
- api: `https://api.example.com`

This keeps the JWT refresh cookie flow simple and avoids unnecessary cross-site cookie issues.

## Migration flow

Use the migration image before rolling out a new API version:

1. build the `api-migrate` service from [`apps/api/Dockerfile.migrate`](../apps/api/Dockerfile.migrate)
2. run it with the same `DATABASE_URL` used by the API
3. after migrations succeed, deploy the `api` service

The migration container runs:

```bash
pnpm db:migrate
```

## Runtime commands

The Dockerfiles already define the production commands:

- API: `node dist/src/main.js`
- Web: `node apps/web/server.js`
- Migrations: `pnpm db:migrate`
