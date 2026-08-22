import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  jsonb,
  timestamp,
  date,
} from 'drizzle-orm/pg-core';

// ── saved_criteria ──────────────────────────────────────────────────────────
export const savedCriteria = pgTable('saved_criteria', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  filters: jsonb('filters').notNull(),
  geographic_bounds: jsonb('geographic_bounds'),
  notifications_enabled: boolean('notifications_enabled').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

// ── pipeline_events ─────────────────────────────────────────────────────────
export const pipelineEvents = pgTable('pipeline_events', {
  event_id: uuid('event_id').primaryKey(), // from webhook
  run_id: uuid('run_id').notNull(),
  county: text('county').notNull(),
  ipns_pointer: text('ipns_pointer').notNull(),
  artifact_cid: text('artifact_cid').notNull(),
  delta_new: integer('delta_new'),
  delta_updated: integer('delta_updated'),
  delta_removed: integer('delta_removed'),
  delta_parcel_ids: jsonb('delta_parcel_ids'),
  received_at: timestamp('received_at').defaultNow(),
  processed_at: timestamp('processed_at'),
  status: text('status').default('pending'),
});

// ── notifications ───────────────────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  criteria_id: uuid('criteria_id').references(() => savedCriteria.id),
  event_id: uuid('event_id').references(() => pipelineEvents.event_id),
  run_id: uuid('run_id'),
  matched_count: integer('matched_count'),
  matched_parcel_ids: jsonb('matched_parcel_ids'),
  summary: text('summary'),
  read: boolean('read').default(false),
  created_at: timestamp('created_at').defaultNow(),
});

// ── opportunities ───────────────────────────────────────────────────────────
export const opportunities = pgTable('opportunities', {
  id: uuid('id').defaultRandom().primaryKey(),
  parcel_id: text('parcel_id').notNull().unique(),
  stage: text('stage').notNull().default('identified'),
  owner_name: text('owner_name'),
  owner_contact_email: text('owner_contact_email'),
  owner_contact_phone: text('owner_contact_phone'),
  owner_interest: text('owner_interest'),
  asking_price: numeric('asking_price'),
  offer_amount: numeric('offer_amount'),
  notes: text('notes'),
  next_steps: text('next_steps'),
  criteria_match_score: numeric('criteria_match_score'),
  source_criteria_id: uuid('source_criteria_id').references(() => savedCriteria.id),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

// ── opportunity_history ─────────────────────────────────────────────────────
export const opportunityHistory = pgTable('opportunity_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  opportunity_id: uuid('opportunity_id')
    .notNull()
    .references(() => opportunities.id),
  from_stage: text('from_stage'),
  to_stage: text('to_stage').notNull(),
  note: text('note'),
  created_at: timestamp('created_at').defaultNow(),
});

// ── tasks ───────────────────────────────────────────────────────────────────
export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  opportunity_id: uuid('opportunity_id')
    .notNull()
    .references(() => opportunities.id),
  title: text('title').notNull(),
  assignee: text('assignee'),
  due_date: date('due_date'),
  completed: boolean('completed').default(false),
  created_at: timestamp('created_at').defaultNow(),
});

// ── outreach_records ────────────────────────────────────────────────────────
export const outreachRecords = pgTable('outreach_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  opportunity_id: uuid('opportunity_id')
    .notNull()
    .references(() => opportunities.id),
  channel: text('channel').notNull(),
  status: text('status').notNull().default('sent'),
  recipient: text('recipient').notNull(),
  subject: text('subject'),
  sent_at: timestamp('sent_at').defaultNow(),
  status_updated_at: timestamp('status_updated_at'),
});
