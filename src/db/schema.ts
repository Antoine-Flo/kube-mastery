// ═══════════════════════════════════════════════════════════════════════════
// DATABASE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════
// Drizzle schema for Supabase tables.
// Used only for migrations, queries use supabase-js directly.

import { sql } from 'drizzle-orm'
import {
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core'
import { authUid, authUsers, authenticatedRole } from 'drizzle-orm/supabase'

// ═══════════════════════════════════════════════════════════════════════════
// TABLES
// ═══════════════════════════════════════════════════════════════════════════

/** Completion types: lesson, chapter, module, course. target_id format depends on type (see plan). */
export const COMPLETION_TYPES = [
  'lesson',
  'chapter',
  'module',
  'course'
] as const
export type CompletionType = (typeof COMPLETION_TYPES)[number]

/**
 * Completions table - One row per completed item (lesson, chapter, module, or course).
 * Enables granular progress and stats. For percentage by course/module, use type = 'lesson'.
 */
export const completions = pgTable(
  'completions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'lesson' | 'chapter' | 'module' | 'course'
    targetId: text('target_id').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    unique('completions_user_type_target_unique').on(
      table.userId,
      table.type,
      table.targetId
    ),
    index('completions_user_id_idx').on(table.userId),
    index('completions_user_type_idx').on(table.userId, table.type),
    pgPolicy('Users can view their own completions', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`
    }),
    pgPolicy('Users can insert their own completions', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`
    }),
    pgPolicy('Users can update their own completions', {
      for: 'update',
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`
    }),
    pgPolicy('Users can delete their own completions', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`
    })
  ]
)

export type InsertCompletion = typeof completions.$inferInsert
export type SelectCompletion = typeof completions.$inferSelect

/**
 * User preferences table - Stores user preferences (theme, locale, etc.)
 */
export const userPreferences = pgTable(
  'preferences',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    theme: text('theme'),
    locale: text('locale'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index('preferences_user_id_idx').on(table.userId),
    pgPolicy('Users can view their own preferences', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`
    }),
    pgPolicy('Users can insert their own preferences', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`
    }),
    pgPolicy('Users can update their own preferences', {
      for: 'update',
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`
    }),
    pgPolicy('Users can delete their own preferences', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`
    })
  ]
)

export type InsertUserPreferences = typeof userPreferences.$inferInsert
export type SelectUserPreferences = typeof userPreferences.$inferSelect

/**
 * Subscriptions table - Stores user subscriptions.
 * plan_tier stores the selected plan tier (basic, pro, enterprise).
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    planTier: text('plan_tier').notNull(),
    status: text('status').notNull(), // "active", "canceled", "past_due", "trialing", "paused"
    paddleSubscriptionId: text('paddle_subscription_id').unique(),
    paddleCustomerId: text('paddle_customer_id'),
    currentPeriodStart: timestamp('current_period_start', {
      withTimezone: true
    }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    metadata: jsonb('metadata').default('{}').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index('subscriptions_user_id_idx').on(table.userId),
    index('subscriptions_status_idx').on(table.status),
    index('subscriptions_paddle_subscription_id_idx').on(
      table.paddleSubscriptionId
    ),
    pgPolicy('Users can view their own subscriptions', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`
    })
  ]
)

export type InsertSubscription = typeof subscriptions.$inferInsert
export type SelectSubscription = typeof subscriptions.$inferSelect

/**
 * Billing events table - Raw Paddle webhook notifications for idempotency and audit.
 */
export const billingEvents = pgTable(
  'billing_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull().default('paddle'),
    notificationId: text('notification_id').notNull().unique(),
    eventType: text('event_type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    payload: jsonb('payload').default('{}').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index('billing_events_notification_id_idx').on(table.notificationId),
    index('billing_events_event_type_idx').on(table.eventType),
    pgPolicy('Users cannot access billing events', {
      for: 'select',
      to: authenticatedRole,
      using: sql`false`
    }),
    pgPolicy('Users cannot insert billing events', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`false`
    }),
    pgPolicy('Users cannot update billing events', {
      for: 'update',
      to: authenticatedRole,
      using: sql`false`,
      withCheck: sql`false`
    }),
    pgPolicy('Users cannot delete billing events', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`false`
    })
  ]
)

export type InsertBillingEvent = typeof billingEvents.$inferInsert
export type SelectBillingEvent = typeof billingEvents.$inferSelect

/**
 * Pending subscriptions table - Checkout/subscription data before a Supabase user is linked.
 */
export const pendingSubscriptions = pgTable(
  'pending_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    planTier: text('plan_tier').notNull(),
    status: text('status').notNull(),
    paddleSubscriptionId: text('paddle_subscription_id').unique(),
    paddleCustomerId: text('paddle_customer_id'),
    currentPeriodStart: timestamp('current_period_start', {
      withTimezone: true
    }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    linkedUserId: uuid('linked_user_id').references(() => authUsers.id, {
      onDelete: 'set null'
    }),
    linkedAt: timestamp('linked_at', { withTimezone: true }),
    magicLinkSentAt: timestamp('magic_link_sent_at', { withTimezone: true }),
    rawData: jsonb('raw_data').default('{}').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index('pending_subscriptions_email_idx').on(table.email),
    index('pending_subscriptions_status_idx').on(table.status),
    index('pending_subscriptions_paddle_subscription_id_idx').on(
      table.paddleSubscriptionId
    ),
    pgPolicy('Users can view their linked pending subscriptions', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${table.linkedUserId} = ${authUid}`
    }),
    pgPolicy('Users can update their linked pending subscriptions', {
      for: 'update',
      to: authenticatedRole,
      using: sql`${table.linkedUserId} = ${authUid}`,
      withCheck: sql`${table.linkedUserId} = ${authUid}`
    }),
    pgPolicy('Users cannot insert pending subscriptions', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`false`
    }),
    pgPolicy('Users cannot delete pending subscriptions', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`false`
    })
  ]
)

export type InsertPendingSubscription = typeof pendingSubscriptions.$inferInsert
export type SelectPendingSubscription = typeof pendingSubscriptions.$inferSelect

// ═══════════════════════════════════════════════════════════════════════════
// USER MESSAGES TABLE
// ═══════════════════════════════════════════════════════════════════════════

/** Type of user message: support, suggestion, or survey response */
export const USER_MESSAGE_TYPES = ['support', 'suggestion', 'survey'] as const
export type UserMessageType = (typeof USER_MESSAGE_TYPES)[number]

/**
 * User messages table - Unified storage for support, suggestions, and survey responses.
 * - type 'support' | 'suggestion': content = { message: "..." }, lessonId = context; name optional
 * - type 'survey': name = survey name (e.g. "intro-feedback"), content = { responses: ... }
 */
export const userMessages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    lessonId: text('lesson_id'), // Optional context for support/suggestion
    type: text('type').notNull(), // 'support' | 'suggestion' | 'survey'
    name: text('name'), // Optional, e.g. survey name
    content: jsonb('content').default('{}').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    index('messages_type_idx').on(table.type),
    index('messages_lesson_id_idx').on(table.lessonId),
    index('messages_created_at_idx').on(table.createdAt),
    index('messages_user_id_idx').on(table.userId),
    pgPolicy('Allow authenticated insert on messages', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`
    }),
    pgPolicy('Users can view their own messages', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`
    }),
    pgPolicy('Allow service role to manage messages', {
      for: 'all',
      to: 'service_role',
      using: sql`true`,
      withCheck: sql`true`
    })
  ]
)

export type InsertUserMessage = typeof userMessages.$inferInsert
export type SelectUserMessage = typeof userMessages.$inferSelect
