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
 * plan_tier references plans defined in src/lib/subscription-plans.ts (free, individual, enterprise).
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
    }),
    pgPolicy('Users can insert their own subscriptions', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`
    }),
    pgPolicy('Users can update their own subscriptions', {
      for: 'update',
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`
    }),
    pgPolicy('Users can delete their own subscriptions', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`
    })
  ]
)

export type InsertSubscription = typeof subscriptions.$inferInsert
export type SelectSubscription = typeof subscriptions.$inferSelect

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
