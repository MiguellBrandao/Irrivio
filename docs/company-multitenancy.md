# Company Multitenancy

This document explains the current company-scoped model used by the Irrivio API and web app.

## Goal

The system now supports multiple companies inside the same database.

- `users` is the global authentication table.
- Every business record belongs to a company.
- The same auth user can belong to more than one company.
- Access is always checked against the company sent in the request.

## Company table

The tenant table is `companies`.

Fields:

- `id`
- `name`
- `slug`
- `logo_path`
- `favicon_path`
- `address`
- `nif`
- `mobile_phone`
- `email`
- `iban`
- `created_at`

Initial configured company:

- `name`: `Floripa Jardins`
- `slug`: `floripa-jardins`
- `address`: `Rua Horta do Palacio- Edf. Palacio Apart.1007, 8500-512 Portimao`
- `logo_path`: `/companies/floripa-jardins.png`
- `favicon_path`: `/companies/floripa-jardins-favicon.png`
- `nif`: `233125825`
- `mobile_phone`: `965403815`
- `email`: `talesbrandao@hotmail.com`
- `iban`: `PT 50 0007 02 87 302 5220 0028 0`

## Data model

`users` does not have `company_id`.

The following tables are company-scoped and now contain `company_id`:

- `company_memberships`
- `company_membership_teams`
- `teams`
- `gardens`
- `tasks`
- `work_logs`
- `products`
- `stock_rules`
- `product_usage`
- `payments`
- `quotes`

Important consequence:

- A user can belong to multiple companies because `company_memberships` stores the membership per company.
- The uniqueness rule is `(user_id, company_id)` in `company_memberships`.

## Membership and access

Access is based on company membership, not just on the JWT user record.

Rules:

- The authenticated user must be an active company member of the target company.
- `admin` can manage company data only inside companies where they also have an active company membership.
- `employee` can only access the parts allowed by each module and only inside companies where they belong.

Current check used by the API:

1. Resolve the `company_id` from query or body.
2. Confirm that the company exists.
3. Confirm that the authenticated user has an active row in `company_memberships` for that company.
4. Apply the module-specific permission rules.

## Request contract

For company-scoped modules:

- `GET` list: send `company_id` in the query string.
- `GET` detail: send `company_id` in the query string.
- `POST`: send `company_id` in the JSON body.
- `PATCH`: send `company_id` in the JSON body.
- `DELETE`: the API resolves the company from the target record and validates access before deleting.

Examples:

```http
GET /company-memberships?company_id=<uuid>
GET /tasks/<id>?company_id=<uuid>
POST /products
PATCH /gardens/<id>
```

```json
{
  "company_id": "uuid",
  "...": "..."
}
```

## Authentication session

`POST /auth/login` and `GET /auth/me` now return:

- `user`
- `companies`
- `accessToken` on login

Example:

```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "uuid",
    "name": "Miguel Work",
    "email": "miguellbwork@gmail.com"
  },
  "companies": [
    {
      "id": "uuid",
      "name": "Floripa Jardins",
      "slug": "floripa-jardins",
      "logo_path": "/companies/floripa-jardins.png",
      "favicon_path": "/companies/floripa-jardins-favicon.png",
      "address": "Rua Horta do Palacio- Edf. Palacio Apart.1007, 8500-512 Portimao",
      "nif": "233125825",
      "mobile_phone": "965403815",
      "email": "talesbrandao@hotmail.com",
      "iban": "PT 50 0007 02 87 302 5220 0028 0",
      "role": "employee"
    }
  ]
}
```

`companies` only contains companies where the user has an active company membership.

## Web behavior

The web auth store now keeps:

- `companies`
- `activeCompanyId`

The selected company is used to:

- scope list queries
- scope detail queries
- add `company_id` to create and update payloads
- sync `active_company_id` and `active_company_favicon_path` cookies
- update the sidebar identity and the browser favicon

If there is no active company, the protected pages block company-scoped actions.

## Module behavior summary

### Company memberships

- Membership is per company.
- The same auth user can have multiple company membership rows, one per company.
- Admin create/update/delete is scoped to the selected company.

### Teams

- Team names are unique per company.

### Gardens

- Gardens belong to a company.
- Employee visibility is limited to gardens reachable through their teams/tasks in that company.

### Tasks

- Tasks belong to a company.
- `garden_id` and `team_id` must belong to the same company as `company_id`.

### Work logs

- Work logs belong to a company.
- `task_id` must belong to that company.
- `team_id` must match the task team.

### Products

- Stock is isolated per company.
- Each product now has a `unit_price` tied to its configured unit.

### Stock rules

- Stock rules belong to a company.
- Each rule points to a product in the same company.
- A rule stores a quantity operator, a threshold, and an email array.

### Product usage

- Usage belongs to a company.
- Product, garden, and company membership must belong to the same company.
- Stock adjustments happen inside the same company scope.

### Payments

- Admin only.
- Payments are isolated per company.

### Quotes

- Admin only.
- Quotes are isolated per company.
- Each quote references a `garden_id` from the same company.
- `services` is stored as a string array.
- `valid_until` defaults to one month after `created_at`.

## Important operational note

Creating a row in `companies` does not automatically grant access to any user.

For a user to see or use a company:

- that user must have an active row in `company_memberships` with that `company_id`

Without that membership, the API correctly rejects the request even if the company exists.
