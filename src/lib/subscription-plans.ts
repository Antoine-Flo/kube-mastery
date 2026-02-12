// ═══════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION PLANS (local config)
// ═══════════════════════════════════════════════════════════════════════════
// Plans are defined here; subscriptions table stores plan_tier (text).
// Display names come from i18n. For paid plans: one base price, promo %, and months free (yearly).
// All displayed prices are derived from that.

export const SUBSCRIPTION_PLAN_TIERS = [
  'free',
  'individual',
  'enterprise'
] as const
export type SubscriptionPlanTier = (typeof SUBSCRIPTION_PLAN_TIERS)[number]

/** Pricing input: base price per month (EUR), promo discount %, months free when paying yearly. */
export interface PlanPricingInput {
  /** Full price per month before any promo, EUR. */
  basePriceMonth: number
  /** Promo discount (e.g. 50 = 50% off). */
  promoPercent: number
  /** Months free when paying yearly (e.g. 2 = "2 months free"). */
  yearlyMonthsFree: number
}

/** Computed prices for display (derived from PlanPricingInput). */
export interface PlanPricingComputed {
  /** Price per month after promo. */
  priceMonth: number
  /** Total amount paid per year when on yearly. */
  priceYearTotal: number
  /** Price per month when paying yearly (priceYearTotal / 12). */
  priceYearPerMonth: number
  /** Strikethrough: full price per month. */
  struckMonth: number
  /** Strikethrough when yearly: monthly equivalent before yearly discount. */
  struckYearPerMonth: number
}

const INDIVIDUAL_PRICING: PlanPricingInput = {
  basePriceMonth: 27,
  promoPercent: 50,
  yearlyMonthsFree: 2
}

export function computePlanPricing(input: PlanPricingInput): PlanPricingComputed {
  const priceMonth = Math.round(
    input.basePriceMonth * (1 - input.promoPercent / 100)
  )
  const monthsPaid = 12 - input.yearlyMonthsFree
  const priceYearTotal = priceMonth * monthsPaid
  const priceYearPerMonth = Math.round(priceYearTotal / 12)
  return {
    priceMonth,
    priceYearTotal,
    priceYearPerMonth,
    struckMonth: input.basePriceMonth,
    struckYearPerMonth: priceMonth
  }
}

export interface SubscriptionPlan {
  tier: SubscriptionPlanTier
  /** i18n key for display name (e.g. pricing_free_name) */
  nameKey: string
  isActive: boolean
  /** If set, all displayed prices are derived from this. */
  pricing?: PlanPricingInput & PlanPricingComputed
}

const PLANS: Record<SubscriptionPlanTier, SubscriptionPlan> = {
  free: {
    tier: 'free',
    nameKey: 'pricing_free_name',
    isActive: true
  },
  individual: {
    tier: 'individual',
    nameKey: 'pricing_earlyaccess_name',
    isActive: true,
    pricing: {
      ...INDIVIDUAL_PRICING,
      ...computePlanPricing(INDIVIDUAL_PRICING)
    }
  },
  enterprise: {
    tier: 'enterprise',
    nameKey: 'pricing_business_name',
    isActive: true
  }
}

export const SUBSCRIPTION_PLANS: Record<
  SubscriptionPlanTier,
  SubscriptionPlan
> = Object.freeze(PLANS) as Record<SubscriptionPlanTier, SubscriptionPlan>

export const SUBSCRIPTION_PLANS_LIST: readonly SubscriptionPlan[] =
  Object.freeze(SUBSCRIPTION_PLAN_TIERS.map((t) => SUBSCRIPTION_PLANS[t]))

/**
 * Returns the plan for the given tier, or undefined if tier is not valid.
 */
export function getPlanByTier(tier: string): SubscriptionPlan | undefined {
  if (SUBSCRIPTION_PLAN_TIERS.includes(tier as SubscriptionPlanTier)) {
    return SUBSCRIPTION_PLANS[tier as SubscriptionPlanTier]
  }
  return undefined
}
