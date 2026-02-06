// ═══════════════════════════════════════════════════════════════════════════
// DATABASE SCHEMA
// ═══════════════════════════════════════════════════════════════════════════
// Drizzle schema for Supabase tables.
// Used only for migrations, queries use supabase-js directly.

import { sql } from 'drizzle-orm'
import { boolean, index, jsonb, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { anonRole, authUid, authUsers, authenticatedRole } from 'drizzle-orm/supabase'

// ═══════════════════════════════════════════════════════════════════════════
// TABLES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * User progress table - Stores all completed lessons per user in JSONB
 */
export const userProgress = pgTable('user_progress', {
    userId: uuid('user_id').primaryKey().references(() => authUsers.id, { onDelete: 'cascade' }),
    completedLessons: jsonb('completed_lessons').default('[]').notNull(), // Array of lesson IDs
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('user_progress_user_id_idx').on(table.userId),
    pgPolicy('Users can view their own progress', {
        for: 'select',
        to: authenticatedRole,
        using: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy('Users can insert their own progress', {
        for: 'insert',
        to: authenticatedRole,
        withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy('Users can update their own progress', {
        for: 'update',
        to: authenticatedRole,
        using: sql`${table.userId} = ${authUid}`,
        withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy('Users can delete their own progress', {
        for: 'delete',
        to: authenticatedRole,
        using: sql`${table.userId} = ${authUid}`,
    }),
])

export type InsertUserProgress = typeof userProgress.$inferInsert
export type SelectUserProgress = typeof userProgress.$inferSelect

/**
 * User preferences table - Stores user preferences (theme, locale, etc.)
 */
export const userPreferences = pgTable('user_preferences', {
    userId: uuid('user_id').primaryKey().references(() => authUsers.id, { onDelete: 'cascade' }),
    theme: text('theme'),
    locale: text('locale'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('user_preferences_user_id_idx').on(table.userId),
    pgPolicy('Users can view their own preferences', {
        for: 'select',
        to: authenticatedRole,
        using: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy('Users can insert their own preferences', {
        for: 'insert',
        to: authenticatedRole,
        withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy('Users can update their own preferences', {
        for: 'update',
        to: authenticatedRole,
        using: sql`${table.userId} = ${authUid}`,
        withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy('Users can delete their own preferences', {
        for: 'delete',
        to: authenticatedRole,
        using: sql`${table.userId} = ${authUid}`,
    }),
])

export type InsertUserPreferences = typeof userPreferences.$inferInsert
export type SelectUserPreferences = typeof userPreferences.$inferSelect

/**
 * Subscriptions table - Stores user subscriptions.
 * plan_tier references plans defined in src/lib/subscription-plans.ts (free, individual, enterprise).
 */
export const subscriptions = pgTable('subscriptions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
    planTier: text('plan_tier').notNull(),
    status: text('status').notNull(), // "active", "canceled", "past_due", "trialing", "paused"
    paddleSubscriptionId: text('paddle_subscription_id').unique(),
    paddleCustomerId: text('paddle_customer_id'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    metadata: jsonb('metadata').default('{}').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('subscriptions_user_id_idx').on(table.userId),
    index('subscriptions_status_idx').on(table.status),
    index('subscriptions_paddle_subscription_id_idx').on(table.paddleSubscriptionId),
    pgPolicy('Users can view their own subscriptions', {
        for: 'select',
        to: authenticatedRole,
        using: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy('Users can insert their own subscriptions', {
        for: 'insert',
        to: authenticatedRole,
        withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy('Users can update their own subscriptions', {
        for: 'update',
        to: authenticatedRole,
        using: sql`${table.userId} = ${authUid}`,
        withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy('Users can delete their own subscriptions', {
        for: 'delete',
        to: authenticatedRole,
        using: sql`${table.userId} = ${authUid}`,
    }),
])

export type InsertSubscription = typeof subscriptions.$inferInsert
export type SelectSubscription = typeof subscriptions.$inferSelect

// ═══════════════════════════════════════════════════════════════════════════
// SURVEY TABLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Survey table - Stores survey responses with name
 * Simple structure: one row per response, with name and responses in JSONB
 */
export const survey = pgTable('surveys', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(), // Name of the survey (e.g., "beta-testers")
    responses: jsonb('responses').notNull(), // Flexible JSON structure for all responses
    userId: uuid('user_id').references(() => authUsers.id, { onDelete: 'set null' }),
    visitorId: text('visitor_id'), // For anonymous responses
    metadata: jsonb('metadata').default('{}').notNull(), // Additional metadata (IP, user agent, etc.)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('survey_name_idx').on(table.name),
    index('survey_user_id_idx').on(table.userId),
    index('survey_visitor_id_idx').on(table.visitorId),
    index('survey_created_at_idx').on(table.createdAt),
    pgPolicy('Allow public insert on survey', {
        for: 'insert',
        to: anonRole,
        withCheck: sql`true`,
    }),
    pgPolicy('Allow authenticated insert on survey', {
        for: 'insert',
        to: authenticatedRole,
        withCheck: sql`true`,
    }),
    pgPolicy('Users can view their own responses', {
        for: 'select',
        to: authenticatedRole,
        using: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy('Allow service role to manage survey', {
        for: 'all',
        to: 'service_role',
        using: sql`true`,
        withCheck: sql`true`,
    }),
])

export type InsertSurvey = typeof survey.$inferInsert
export type SelectSurvey = typeof survey.$inferSelect

// ═══════════════════════════════════════════════════════════════════════════
// SUGGESTIONS TABLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Suggestions table - User feedback for lesson content
 */
export const suggestions = pgTable('suggestions', {
    id: uuid('id').primaryKey().defaultRandom(),
    text: text('text').notNull(),
    lessonId: text('lesson_id').notNull(),
    userId: uuid('user_id').references(() => authUsers.id, { onDelete: 'set null' }),
    visitorId: text('visitor_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('suggestions_lesson_id_idx').on(table.lessonId),
    index('suggestions_created_at_idx').on(table.createdAt),
    pgPolicy('Allow public insert on suggestions', {
        for: 'insert',
        to: anonRole,
        withCheck: sql`true`,
    }),
    pgPolicy('Allow authenticated insert on suggestions', {
        for: 'insert',
        to: authenticatedRole,
        withCheck: sql`true`,
    }),
])

export type InsertSuggestion = typeof suggestions.$inferInsert
export type SelectSuggestion = typeof suggestions.$inferSelect
