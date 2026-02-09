/**
 * Auth domain: business rules only (no DB, no Supabase).
 */

/**
 * Returns whether a subscription row counts as a paid subscription.
 */
export function isPaidSubscription(planTier: string, status: string): boolean {
  const paidTiers = ['individual', 'enterprise']
  const activeStatuses = ['active', 'trialing']
  return paidTiers.includes(planTier) && activeStatuses.includes(status)
}
