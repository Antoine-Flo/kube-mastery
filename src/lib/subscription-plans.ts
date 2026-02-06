// ═══════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION PLANS (local config)
// ═══════════════════════════════════════════════════════════════════════════
// Plans are defined here; subscriptions table stores plan_tier (text).
// Display names come from i18n (e.g. pricing_free_name, pricing_fullaccess_name).

export const SUBSCRIPTION_PLAN_TIERS = ['free', 'individual', 'enterprise'] as const
export type SubscriptionPlanTier = (typeof SUBSCRIPTION_PLAN_TIERS)[number]

export interface SubscriptionPlan {
  tier: SubscriptionPlanTier
  /** i18n key for display name (e.g. pricing_free_name) */
  nameKey: string
  isActive: boolean
}

const PLANS: Record<SubscriptionPlanTier, SubscriptionPlan> = {
  free: {
    tier: 'free',
    nameKey: 'pricing_free_name',
    isActive: true
  },
  individual: {
    tier: 'individual',
    nameKey: 'pricing_subscription_name',
    isActive: true
  },
  enterprise: {
    tier: 'enterprise',
    nameKey: 'pricing_fullaccess_name',
    isActive: true
  }
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanTier, SubscriptionPlan> = Object.freeze(PLANS) as Record<
  SubscriptionPlanTier,
  SubscriptionPlan
>

export const SUBSCRIPTION_PLANS_LIST: readonly SubscriptionPlan[] = Object.freeze(
  SUBSCRIPTION_PLAN_TIERS.map((t) => SUBSCRIPTION_PLANS[t])
)

/**
 * Returns the plan for the given tier, or undefined if tier is not valid.
 */
export function getPlanByTier(tier: string): SubscriptionPlan | undefined {
  if (SUBSCRIPTION_PLAN_TIERS.includes(tier as SubscriptionPlanTier)) {
    return SUBSCRIPTION_PLANS[tier as SubscriptionPlanTier]
  }
  return undefined
}
