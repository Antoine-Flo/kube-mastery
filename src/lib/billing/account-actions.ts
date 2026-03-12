import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type BillingSubscriptionRow,
  pickBestBillingSubscription
} from './domain'

export function getSafeRedirectTarget(
  redirectParam: string | null,
  fallback: string
): string {
  if (!redirectParam) {
    return fallback
  }
  const path =
    redirectParam.startsWith('/') && !redirectParam.includes('//')
      ? redirectParam
      : ''
  return path || fallback
}

export function addFlashParam(
  redirectPath: string,
  key: string,
  value: string
): string {
  const targetUrl = new URL(redirectPath, 'http://localhost')
  targetUrl.searchParams.set(key, value)
  return `${targetUrl.pathname}${targetUrl.search}`
}

type BillingActionSubscription = {
  paddleSubscriptionId: string
  paddleCustomerId: string | null
  status: string
  planTier: string
}

function toBillingActionSubscription(
  data: BillingSubscriptionRow | null
): BillingActionSubscription | null {
  const paddleSubscriptionId = data?.paddle_subscription_id
  if (paddleSubscriptionId == null || paddleSubscriptionId === '') {
    return null
  }
  return {
    paddleSubscriptionId,
    paddleCustomerId: data?.paddle_customer_id ?? null,
    status: data?.status ?? 'unknown',
    planTier: data?.plan_tier ?? 'unknown'
  }
}

export async function getLatestUserSubscriptionForBilling(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  data: BillingActionSubscription | null
  error: string | null
}> {
  const result = await supabase
    .from('subscriptions')
    .select('paddle_subscription_id, paddle_customer_id, status, plan_tier')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (result.error != null) {
    return { data: null, error: result.error.message }
  }
  const bestRow = pickBestBillingSubscription(
    (result.data as BillingSubscriptionRow[] | null) ?? []
  )
  return { data: toBillingActionSubscription(bestRow), error: null }
}
