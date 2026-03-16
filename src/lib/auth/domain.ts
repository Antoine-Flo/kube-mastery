/**
 * Auth domain: business rules only (no DB, no Supabase).
 */

const PAID_PLAN_TIERS = ['basic', 'pro', 'enterprise', 'early_access'] as const
const PAID_SUBSCRIPTION_STATUSES = ['active', 'trialing'] as const

/**
 * Returns whether a subscription row counts as a paid subscription.
 */
export function isPaidSubscription(planTier: string, status: string): boolean {
  return (
    PAID_PLAN_TIERS.includes(planTier as (typeof PAID_PLAN_TIERS)[number]) &&
    PAID_SUBSCRIPTION_STATUSES.includes(
      status as (typeof PAID_SUBSCRIPTION_STATUSES)[number]
    )
  )
}
