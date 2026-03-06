export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAUSED: 'paused',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled'
} as const

export const PAID_SUBSCRIPTION_STATUSES = [
  SUBSCRIPTION_STATUS.ACTIVE,
  SUBSCRIPTION_STATUS.TRIALING
] as const

export const ALLOWED_SUBSCRIPTION_STATUSES = [
  SUBSCRIPTION_STATUS.ACTIVE,
  SUBSCRIPTION_STATUS.CANCELED,
  SUBSCRIPTION_STATUS.PAST_DUE,
  SUBSCRIPTION_STATUS.PAUSED,
  SUBSCRIPTION_STATUS.TRIALING
] as const

export type BillingSubscriptionRow = {
  paddle_subscription_id: string | null
  paddle_customer_id?: string | null
  status: string | null
  plan_tier: string | null
}

export function isPaidSubscriptionStatus(status: string): boolean {
  return PAID_SUBSCRIPTION_STATUSES.includes(
    status as (typeof PAID_SUBSCRIPTION_STATUSES)[number]
  )
}

export function isAllowedSubscriptionStatus(status: string): boolean {
  return ALLOWED_SUBSCRIPTION_STATUSES.includes(
    status as (typeof ALLOWED_SUBSCRIPTION_STATUSES)[number]
  )
}

export function resolvePendingSubscriptionStatus(args: {
  incomingStatus: string
  existingStatus: string | null
}): string {
  if (isAllowedSubscriptionStatus(args.incomingStatus)) {
    return args.incomingStatus
  }
  if (
    args.existingStatus != null &&
    isAllowedSubscriptionStatus(args.existingStatus)
  ) {
    return args.existingStatus
  }
  return args.incomingStatus
}

export function pickBestBillingSubscription(
  rows: BillingSubscriptionRow[]
): BillingSubscriptionRow | null {
  if (rows.length === 0) {
    return null
  }
  for (const row of rows) {
    const status = row.status ?? ''
    if (isPaidSubscriptionStatus(status)) {
      return row
    }
  }
  return rows[0]
}
