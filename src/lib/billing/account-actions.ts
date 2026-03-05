import type { SupabaseClient } from '@supabase/supabase-js'

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

export type BillingActionSubscription = {
  paddleSubscriptionId: string
  status: string
  planTier: string
}

export async function getLatestUserSubscriptionForBilling(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  data: BillingActionSubscription | null
  error: string | null
}> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('paddle_subscription_id, status, plan_tier')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error != null) {
    return { data: null, error: error.message }
  }

  const paddleSubscriptionId =
    (data?.paddle_subscription_id as string | null) ?? null
  if (paddleSubscriptionId == null || paddleSubscriptionId === '') {
    return { data: null, error: null }
  }

  return {
    data: {
      paddleSubscriptionId,
      status: (data?.status as string | null) ?? 'unknown',
      planTier: (data?.plan_tier as string | null) ?? 'unknown'
    },
    error: null
  }
}
