import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    isSuperAdmin: boolean('is_super_admin').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex('users_email_unique').on(table.email),
  }),
);

export const companies = pgTable(
  'companies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    logoPath: text('logo_path'),
    faviconPath: text('favicon_path'),
    address: text('address').notNull(),
    nif: varchar('nif', { length: 50 }).notNull(),
    mobilePhone: varchar('mobile_phone', { length: 50 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    iban: varchar('iban', { length: 64 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex('companies_slug_unique').on(table.slug),
  }),
);

export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const companyMemberships = pgTable(
  'company_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    role: varchar('role', { length: 50 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 50 }),
    active: boolean('active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userCompanyUnique: uniqueIndex('company_memberships_user_company_unique').on(
      table.userId,
      table.companyId,
    ),
  }),
);

export const companyMembershipTeams = pgTable(
  'company_membership_teams',
  {
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    companyMembershipId: uuid('company_membership_id')
      .notNull()
      .references(() => companyMemberships.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.companyMembershipId, table.teamId] }),
  }),
);

export const gardens = pgTable('gardens', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  clientName: varchar('client_name', { length: 255 }).notNull(),
  address: text('address').notNull(),
  phone: varchar('phone', { length: 50 }),
  monthlyPrice: numeric('monthly_price', { precision: 10, scale: 2 }),
  maintenanceFrequency: varchar('maintenance_frequency', { length: 50 }),
  startDate: date('start_date'),
  billingDay: integer('billing_day'),
  status: varchar('status', { length: 50 }).default('active').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const taskTypeEnum = pgEnum('task_type_enum', [
  'maintenance',
  'pruning',
  'cleaning',
  'installation',
  'inspection',
  'emergency',
]);

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  gardenId: uuid('garden_id')
    .notNull()
    .references(() => gardens.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  date: date('date').notNull(),
  startTime: time('start_time'),
  endTime: time('end_time'),
  taskType: taskTypeEnum('task_type').default('maintenance').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workLogs = pgTable('work_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const productUnitEnum = pgEnum('product_unit_enum', [
  'unit',
  'kg',
  'g',
  'l',
  'ml',
  'm',
  'm2',
  'm3',
  'pack',
]);

export const stockRuleOperatorEnum = pgEnum('stock_rule_operator_enum', [
  'lt',
  'lte',
  'eq',
  'gt',
  'gte',
]);

export const expenseCategoryEnum = pgEnum('expense_category_enum', [
  'fuel',
  'tolls',
  'parking',
  'equipment',
  'maintenance',
  'transport',
  'other',
]);

export const irrigationFrequencyEnum = pgEnum('irrigation_frequency_enum', [
  'daily',
  'every_n_days',
  'weekly',
]);

export const reportTypeEnum = pgEnum('report_type_enum', ['general']);

export const reportPeriodTypeEnum = pgEnum('report_period_type_enum', [
  'this_month',
  'last_month',
  'last_year',
  'all_time',
  'custom',
]);

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  unit: productUnitEnum('unit').notNull(),
  stockQuantity: numeric('stock_quantity', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stockRules = pgTable('stock_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  operator: stockRuleOperatorEnum('operator').notNull(),
  thresholdQuantity: numeric('threshold_quantity', {
    precision: 10,
    scale: 2,
  }).notNull(),
  emails: text('emails')
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const productUsage = pgTable('product_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  gardenId: uuid('garden_id')
    .notNull()
    .references(() => gardens.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, {
    onDelete: 'set null',
  }),
  companyMembershipId: uuid('company_membership_id').references(
    () => companyMemberships.id,
    {
      onDelete: 'set null',
    },
  ),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull(),
  date: date('date').notNull(),
  notes: text('notes'),
});

export const expenses = pgTable('expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  gardenId: uuid('garden_id')
    .notNull()
    .references(() => gardens.id, { onDelete: 'cascade' }),
  category: expenseCategoryEnum('category').notNull(),
  description: text('description'),
  amount: numeric('amount', { precision: 10, scale: 2 })
    .default('0')
    .notNull(),
  date: date('date').notNull(),
});

export const irrigationZones = pgTable('irrigation_zones', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  gardenId: uuid('garden_id')
    .notNull()
    .references(() => gardens.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  frequencyType: irrigationFrequencyEnum('frequency_type').notNull(),
  intervalDays: integer('interval_days'),
  weekDays: text('week_days')
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  startDate: date('start_date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  gardenId: uuid('garden_id')
    .notNull()
    .references(() => gardens.id, { onDelete: 'cascade' }),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  paidAt: timestamp('paid_at'),
  notes: text('notes'),
});

export const quotes = pgTable('quotes', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  gardenId: uuid('garden_id')
    .notNull()
    .references(() => gardens.id, { onDelete: 'cascade' }),
  services: text('services')
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  validUntil: date('valid_until')
    .notNull()
    .default(sql`(now() + interval '1 month')::date`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  generatedByCompanyMembershipId: uuid('generated_by_company_membership_id').references(
    () => companyMemberships.id,
    {
      onDelete: 'set null',
    },
  ),
  generatedByName: varchar('generated_by_name', { length: 255 }).notNull(),
  reportType: reportTypeEnum('report_type').notNull().default('general'),
  periodType: reportPeriodTypeEnum('period_type').notNull(),
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
  title: varchar('title', { length: 255 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  fileBase64: text('file_base64').notNull(),
  summaryJson: text('summary_json').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
