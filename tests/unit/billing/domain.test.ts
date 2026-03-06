import { describe, expect, it } from 'vitest'
import {
  isAllowedSubscriptionStatus,
  isPaidSubscriptionStatus,
  pickBestBillingSubscription,
  resolvePendingSubscriptionStatus,
  type BillingSubscriptionRow
} from '../../../src/lib/billing/domain'

describe('isAllowedSubscriptionStatus', () => {
  it('accepts Paddle subscription statuses only', () => {
    expect(isAllowedSubscriptionStatus('active')).toBe(true)
    expect(isAllowedSubscriptionStatus('trialing')).toBe(true)
    expect(isAllowedSubscriptionStatus('paused')).toBe(true)
    expect(isAllowedSubscriptionStatus('past_due')).toBe(true)
    expect(isAllowedSubscriptionStatus('canceled')).toBe(true)
    expect(isAllowedSubscriptionStatus('completed')).toBe(false)
    expect(isAllowedSubscriptionStatus('unknown')).toBe(false)
  })
})

describe('isPaidSubscriptionStatus', () => {
  it('treats only active and trialing as paid', () => {
    expect(isPaidSubscriptionStatus('active')).toBe(true)
    expect(isPaidSubscriptionStatus('trialing')).toBe(true)
    expect(isPaidSubscriptionStatus('paused')).toBe(false)
    expect(isPaidSubscriptionStatus('canceled')).toBe(false)
  })
})

describe('resolvePendingSubscriptionStatus', () => {
  it('keeps incoming status when it is an allowed subscription status', () => {
    const resolved = resolvePendingSubscriptionStatus({
      incomingStatus: 'active',
      existingStatus: 'canceled'
    })
    expect(resolved).toBe('active')
  })

  it('falls back to existing status when incoming is not allowed', () => {
    const resolved = resolvePendingSubscriptionStatus({
      incomingStatus: 'completed',
      existingStatus: 'trialing'
    })
    expect(resolved).toBe('trialing')
  })

  it('keeps incoming status when both incoming and existing are not allowed', () => {
    const resolved = resolvePendingSubscriptionStatus({
      incomingStatus: 'completed',
      existingStatus: 'unknown'
    })
    expect(resolved).toBe('completed')
  })
})

describe('pickBestBillingSubscription', () => {
  function row(status: string): BillingSubscriptionRow {
    return {
      paddle_subscription_id: `sub_${status}`,
      status,
      plan_tier: 'pro'
    }
  }

  it('returns null when list is empty', () => {
    expect(pickBestBillingSubscription([])).toBeNull()
  })

  it('returns the first paid subscription if present', () => {
    const best = pickBestBillingSubscription([
      row('canceled'),
      row('trialing'),
      row('active')
    ])
    expect(best?.status).toBe('trialing')
  })

  it('falls back to the latest row when no paid status is present', () => {
    const best = pickBestBillingSubscription([row('paused'), row('canceled')])
    expect(best?.status).toBe('paused')
  })
})
