/**
 * Early access cap: user count RPC and automatic early_access subscription.
 * Used when EARLY_STAGE=true to limit signups and grant lifetime access.
 */

import { getSupabaseAdmin } from '../supabase'
import { isPaidSubscription } from './domain'

export const EARLY_ACCESS_CAP = 1000

const RPC_NAME = 'get_auth_user_count'

/**
 * Returns the current number of users in auth.users, or null on error.
 * Must be called with admin client (service role).
 */
export async function getAuthUserCount(locals: unknown): Promise<number | null> {
  const admin = getSupabaseAdmin(locals)
  if (admin == null) {
    return null
  }
  const { data, error } = await admin.rpc(RPC_NAME)
  if (error != null) {
    return null
  }
  if (typeof data !== 'number' || !Number.isFinite(data) || data < 0) {
    return null
  }
  return data
}

/**
 * Ensures the user has an active early_access subscription.
 * If they have no subscription or none with active status, inserts one.
 * No-op if they already have a paid subscription (e.g. from Paddle).
 */
export async function ensureEarlyAccessSubscription(
  locals: unknown,
  userId: string
): Promise<void> {
  if (userId.trim() === '') {
    return
  }
  const admin = getSupabaseAdmin(locals)
  if (admin == null) {
    return
  }
  const { data: rows, error: selectError } = await admin
    .from('subscriptions')
    .select('plan_tier, status')
    .eq('user_id', userId)

  if (selectError != null) {
    return
  }
  const hasPaid = (rows ?? []).some((row) =>
    isPaidSubscription(row.plan_tier, row.status)
  )
  if (hasPaid) {
    return
  }
  await admin.from('subscriptions').insert({
    user_id: userId,
    plan_tier: 'early_access',
    status: 'active',
    paddle_subscription_id: null,
    paddle_customer_id: null
  })
}
