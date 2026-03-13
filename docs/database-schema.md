# Visão Geral das Entidades

O sistema é composto pelas seguintes entidades principais:

- Users (login)
- Employees (funcionários)
- Teams (equipas)
- Gardens (clientes/jardins)
- Tasks (trabalhos no calendário)
- Work Logs (registo de trabalho)
- Products (produtos)
- Product Usage (produtos usados)
- Payments (pagamentos dos clientes)
- Quotes (orçamentos)

---

# 1. Users

Utilizadores que podem fazer login no sistema.

users
```
| Campo | Tipo | Descrição |
|------|------|-----------|
| id | uuid | Primary key |
| email | varchar | Email de login |
| password_hash | varchar | Password encriptada |
| role | varchar | admin / employee |
| created_at | timestamp | Data de criação |
```

# 2. Employees

Funcionários da empresa.

employees
```
| Campo | Tipo | Descrição |
|------|------|-----------|
| id | uuid | Primary key |
| user_id | uuid | Conta associada |
| name | varchar | Nome do funcionário |
| phone | varchar | Telefone |
| team_id | uuid | Equipa |
| active | boolean | Se está ativo |
| created_at | timestamp | Data de criação |
```

# 3. Teams

Equipas de trabalho.

teams
```
| Campo | Tipo | Descrição |
|------|------|-----------|
| id | uuid | Primary key |
| name | varchar | Nome da equipa |
| created_at | timestamp | Data criação |
```

# 4. Gardens (Clientes)

Cada jardim corresponde a um cliente com contrato.

gardens
```
| Campo | Tipo | Descrição |
|------|------|-----------|
| id | uuid | Primary key |
| client_name | varchar | Nome do cliente |
| address | text | Morada |
| phone | varchar | Contacto |
| monthly_price | numeric | Valor mensal |
| maintenance_frequency | varchar | weekly / biweekly / monthly |
| start_date | date | Data início contrato |
| billing_day | integer | Dia de pagamento esperado |
| status | varchar | active / paused / cancelled |
| notes | text | Observações |
| created_at | timestamp | Data criação |
```

# 5. Tasks (Trabalhos no Calendário)

Representa um trabalho planeado.

tasks
```
| Campo | Tipo | Descrição |
|------|------|-----------|
| id | uuid | Primary key |
| garden_id | uuid | Jardim |
| team_id | uuid | Equipa |
| date | date | Data |
| start_time | time | Hora início prevista |
| end_time | time | Hora fim prevista |
| task_type | varchar | Tipo de trabalho |
| notes | text | Notas |
| created_at | timestamp | Data criação |
```

# 6. Work Logs

Registo real do trabalho executado.

work_logs
```
| Campo | Tipo | Descrição |
|------|------|-----------|
| id | uuid | Primary key |
| task_id | uuid | Trabalho |
| employee_id | uuid | Funcionário |
| start_time | timestamp | Hora início |
| end_time | timestamp | Hora fim |
| notes | text | Observações |
| created_at | timestamp | Data criação |
```

# 7. Products

Produtos utilizados pela empresa.

products
```
| Campo | Tipo | Descrição |
|------|------|-----------|
| id | uuid | Primary key |
| name | varchar | Nome do produto |
| unit | varchar | kg / L / units |
| stock_quantity | numeric | Quantidade em stock |
| created_at | timestamp | Data criação |
```


# 8. Product Usage

Registo de produtos usados em jardins.

product_usage
```
| Campo | Tipo | Descrição |
|------|------|-----------|
| id | uuid | Primary key |
| product_id | uuid | Produto |
| garden_id | uuid | Jardim |
| employee_id | uuid | Funcionário |
| quantity | numeric | Quantidade usada |
| date | date | Data |
| notes | text | Notas |
```

# 9. Payments

Pagamentos feitos pelos clientes.

Suporta **pagamentos parciais**.

payments
```
| Campo | Tipo | Descrição |
|------|------|-----------|
| id | uuid | Primary key |
| garden_id | uuid | Cliente |
| month | integer | Mês |
| year | integer | Ano |
| amount | numeric | Valor pago |
| paid_at | timestamp | Data pagamento |
| notes | text | Observações |

```

# 10. Quotes (Orçamentos)

Orçamentos para novos clientes.

quotes
```
| Campo | Tipo | Descrição |
|------|------|-----------|
| id | uuid | Primary key |
| client_name | varchar | Cliente |
| address | text | Morada |
| description | text | Descrição |
| price | numeric | Valor |
| status | varchar | draft / sent / accepted / rejected |
| created_at | timestamp | Data criação |
```
