import type { APIRoute } from 'astro'
import {
  addFlashParam,
  getLatestUserSubscriptionForBilling,
  getSafeRedirectTarget
} from '../../../lib/billing/account-actions'
import { createPaddleCustomerPortalOverviewLink } from '../../../lib/billing/provisioning'
import {
  createApiLogContext,
  emitApiLog,
  getDurationMs,
  startTimer
} from '../../../lib/observability/otel'
import { getSupabaseServer } from '../../../lib/supabase'

export const GET: APIRoute = async ({
  request,
  cookies,
  locals,
  url,
  redirect
}) => {
  const startedAt = startTimer()
  const baseContext = createApiLogContext({
    request,
    route: '/api/account/subscription-portal',
    locals
  })
  const redirectTo = getSafeRedirectTarget(
    url.searchParams.get('redirect'),
    '/en/profile'
  )

  const supabase = getSupabaseServer(locals, request, cookies)
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  if (userError != null || user == null) {
    emitApiLog({
      level: 'warn',
      event: 'billing_portal_failed',
      message: 'Open customer portal unauthorized',
      context: baseContext,
      statusCode: 401,
      durationMs: getDurationMs(startedAt),
      errorCode: 'unauthorized'
    })
    return redirect(addFlashParam(redirectTo, 'billing_error', 'unauthorized'))
  }

  const context = createApiLogContext({
    request,
    route: '/api/account/subscription-portal',
    locals,
    userId: user.id
  })
  const subscriptionResult = await getLatestUserSubscriptionForBilling(
    supabase,
    user.id
  )
  if (subscriptionResult.error != null) {
    emitApiLog({
      level: 'error',
      event: 'billing_portal_failed',
      message: 'Open customer portal failed during lookup',
      context,
      statusCode: 500,
      durationMs: getDurationMs(startedAt),
      errorCode: 'action_failed'
    })
    return redirect(addFlashParam(redirectTo, 'billing_error', 'action_failed'))
  }
  if (subscriptionResult.data == null) {
    emitApiLog({
      level: 'warn',
      event: 'billing_portal_failed',
      message: 'Open customer portal failed: subscription not found',
      context,
      statusCode: 404,
      durationMs: getDurationMs(startedAt),
      errorCode: 'subscription_not_found'
    })
    return redirect(
      addFlashParam(redirectTo, 'billing_error', 'subscription_not_found')
    )
  }

  const paddleCustomerId = subscriptionResult.data.paddleCustomerId
  if (paddleCustomerId == null || paddleCustomerId === '') {
    emitApiLog({
      level: 'error',
      event: 'billing_portal_failed',
      message: 'Open customer portal failed: missing customer ID',
      context,
      statusCode: 500,
      durationMs: getDurationMs(startedAt),
      errorCode: 'action_failed'
    })
    return redirect(addFlashParam(redirectTo, 'billing_error', 'action_failed'))
  }

  const portalResult = await createPaddleCustomerPortalOverviewLink({
    locals,
    paddleCustomerId,
    paddleSubscriptionId: subscriptionResult.data.paddleSubscriptionId
  })
  if (!portalResult.ok || portalResult.url == null) {
    emitApiLog({
      level: 'error',
      event: 'billing_portal_failed',
      message: 'Open customer portal failed on provider call',
      context,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'action_failed'
    })
    return redirect(addFlashParam(redirectTo, 'billing_error', 'action_failed'))
  }

  emitApiLog({
    level: 'info',
    event: 'billing_portal_succeeded',
    message: 'Open customer portal succeeded',
    context,
    statusCode: 200,
    durationMs: getDurationMs(startedAt)
  })
  return redirect(portalResult.url)
}
