# API Endpoints

Base URL example:

```
/api
```

---

# Authentication

```
POST /auth/login
POST /auth/logout
GET /auth/me
```

Login returns:

- JWT token
- user role

Roles:

- admin
- employee

---

# Employees

```
GET /employees
POST /employees
GET /employees/:id
PATCH /employees/:id
DELETE /employees/:id
```

---

# Teams

```
GET /teams
POST /teams
PATCH /teams/:id
DELETE /teams/:id
```

---

# Gardens (Clients)

```
GET /gardens
POST /gardens
GET /gardens/:id
PATCH /gardens/:id
DELETE /gardens/:id
```

Fields:

- client_name
- address
- phone
- monthly_price
- maintenance_frequency
- start_date
- billing_day
- status
- notes

---

# Calendar / Tasks

```
GET /tasks
POST /tasks
GET /tasks/:id
PATCH /tasks/:id
DELETE /tasks/:id
```

Task fields:

- garden_id
- team_id
- date
- start_time
- end_time
- task_type
- notes

---

# Work Logs

Used by employees to register work done.

```
POST /worklogs
GET /worklogs
GET /worklogs/:id
```

Fields:

- task_id
- employee_id
- start_time
- end_time
- notes

---

# Products

```
GET /products
POST /products
PATCH /products/:id
DELETE /products/:id
```

Fields:

- name
- unit
- stock_quantity

---

# Product Usage

Records products used in gardens.

```
POST /product-usage
GET /product-usage
```

Fields:

- product_id
- garden_id
- employee_id
- quantity
- date
- notes

---

# Payments

```
GET /payments
POST /payments
PATCH /payments/:id
```

Fields:

- garden_id
- month
- year
- amount
- paid_at
- notes

---

# Quotes (Orçamentos)

```
GET /quotes
POST /quotes
PATCH /quotes/:id
DELETE /quotes/:id
```

Fields:

- client_name
- address
- description
- price
- status

Status:

- draft
- sent
- accepted
- rejected
