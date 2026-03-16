# Irrivio Overview

Irrivio is a monorepo for a garden-services intranet with a NestJS API and a Next.js web app.

## Company model

- `companies` is the tenant table.
- `users` is the only table without `company_id`.
- Every business table is company-scoped.
- The same auth user can belong to multiple companies through multiple rows in `company_memberships`.
- A request is valid only when the authenticated user is an active company member of the target company.

## Session model

- `POST /auth/login` returns `accessToken`, `user`, and the list of accessible `companies`.
- `GET /auth/me` returns the same session payload.
- The web stores the company list in the auth store and keeps an `activeCompanyId`.
- Each company in the session payload includes branding plus contact/billing settings.
- The active company is sent on company-scoped requests through `company_id`.

## Roles

### Admin

- Can create, update, and delete company-scoped business data.
- Still needs an active company membership in the company being accessed.

### Employee

- Has read access only to the data allowed by each module.
- Can only act inside companies where they have an active company membership.

## Main domains

- `company-memberships`: company memberships per company and team assignments.
- `teams`: work teams inside a company.
- `gardens`: clients/contracts per company.
- `tasks`: scheduled work for gardens and teams.
- `worklogs`: executed work logs tied to tasks and teams.
- `products`: company stock catalog with per-unit pricing.
- `stock-rules`: company-specific stock alert rules by product, quantity condition, and notification emails.
- `product-usage`: stock consumption tied to gardens and company memberships.
- `payments`: client payments, admin only.
- `quotes`: company-scoped quotes linked to gardens, with services arrays and validity date, admin only.

## Request rules

- `GET` list endpoints accept `company_id` as query parameter.
- `GET` detail endpoints also accept `company_id` as query parameter.
- `POST` and `PATCH` bodies must include `company_id`.
- Responses for company-scoped resources include `company_id`.
- `DELETE` endpoints infer the company from the target resource and still validate membership/permissions.

## Exception

- `PATCH /users/me` updates the authenticated user profile and is not company-scoped.
