import type { APIRoute } from 'astro'
import {
  addFlashParam,
  getLatestUserSubscriptionForBilling,
  getSafeRedirectTarget
} from '../../../lib/billing/account-actions'
import {
  actionJsonError,
  actionJsonSuccess,
  isAjaxFormAction
} from '../../../lib/form-action-server'
import { createRefundRequestMessage } from '../../../lib/billing/provisioning'
import {
  createApiLogContext,
  emitApiLog,
  getDurationMs,
  startTimer
} from '../../../lib/api-log'
import { getSupabaseServer } from '../../../lib/supabase'
import { CONFIG } from '../../../config'
import { getTrustedClientIp } from '../../../lib/client-ip'

const refundRateLimitStore = new Map<
  string,
  { count: number; windowStartedAt: number }
>()

function getRateLimitKey(args: {
  userId: string
  clientIp: string | null
}): string {
  if (args.clientIp != null && args.clientIp !== '') {
    return `user:${args.userId}:ip:${args.clientIp}`
  }
  return `user:${args.userId}`
}

function isRateLimited(args: {
  key: string
  now: number
  windowMs: number
  maxRequests: number
}): boolean {
  const current = refundRateLimitStore.get(args.key)
  if (current == null) {
    refundRateLimitStore.set(args.key, {
      count: 1,
      windowStartedAt: args.now
    })
    return false
  }
  if (args.now - current.windowStartedAt >= args.windowMs) {
    refundRateLimitStore.set(args.key, {
      count: 1,
      windowStartedAt: args.now
    })
    return false
  }
  if (current.count >= args.maxRequests) {
    return true
  }
  current.count += 1
  refundRateLimitStore.set(args.key, current)
  return false
}

export const POST: APIRoute = async ({
  request,
  cookies,
  locals,
  url,
  redirect,
  clientAddress
}) => {
  const startedAt = startTimer()
  const baseContext = createApiLogContext({
    request,
    route: '/api/account/subscription-refund',
    locals
  })
  const isAjax = isAjaxFormAction(request)
  const redirectTo = getSafeRedirectTarget(
    url.searchParams.get('redirect'),
    '/en/profile'
  )
  const formData = await request.formData()
  const departureReasonRaw = formData.get('departureReason')
  const departureReason =
    typeof departureReasonRaw === 'string'
      ? departureReasonRaw.trim().slice(0, 1500)
      : ''

  const supabase = getSupabaseServer(locals, request, cookies)
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  if (userError != null || user == null) {
    emitApiLog({
      level: 'warn',
      event: 'billing_refund_failed',
      message: 'Refund request unauthorized',
      context: baseContext,
      statusCode: 401,
      durationMs: getDurationMs(startedAt),
      errorCode: 'unauthorized'
    })
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'unauthorized' }, 401)
    }
    return redirect(addFlashParam(redirectTo, 'billing_error', 'unauthorized'))
  }

  const subscriptionResult = await getLatestUserSubscriptionForBilling(
    supabase,
    user.id
  )
  const context = createApiLogContext({
    request,
    route: '/api/account/subscription-refund',
    locals,
    userId: user.id
  })
  const rateLimitNow = Date.now()
  const clientIp = getTrustedClientIp({ request, clientAddress })
  const rateLimitKey = getRateLimitKey({ userId: user.id, clientIp })
  const isLimited = isRateLimited({
    key: rateLimitKey,
    now: rateLimitNow,
    windowMs: CONFIG.billing.refundRateLimit.windowMs,
    maxRequests: CONFIG.billing.refundRateLimit.maxRequests
  })
  if (isLimited) {
    emitApiLog({
      level: 'warn',
      event: 'billing_refund_failed',
      message: 'Refund request failed: rate limit exceeded',
      context,
      statusCode: 429,
      durationMs: getDurationMs(startedAt),
      errorCode: 'rate_limited'
    })
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'rate_limited' }, 429)
    }
    return redirect(addFlashParam(redirectTo, 'billing_error', 'rate_limited'))
  }
  if (subscriptionResult.error != null) {
    emitApiLog({
      level: 'error',
      event: 'billing_refund_failed',
      message: 'Refund request failed during lookup',
      context,
      statusCode: 500,
      durationMs: getDurationMs(startedAt),
      errorCode: 'action_failed'
    })
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'action_failed' }, 500)
    }
    return redirect(addFlashParam(redirectTo, 'billing_error', 'refund_failed'))
  }

  if (subscriptionResult.data == null) {
    emitApiLog({
      level: 'warn',
      event: 'billing_refund_failed',
      message: 'Refund request failed: subscription not found',
      context,
      statusCode: 404,
      durationMs: getDurationMs(startedAt),
      errorCode: 'subscription_not_found'
    })
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'subscription_not_found' }, 404)
    }
    return redirect(
      addFlashParam(redirectTo, 'billing_error', 'subscription_not_found')
    )
  }

  const refundResult = await createRefundRequestMessage({
    locals,
    userId: user.id,
    userEmail: user.email ?? null,
    paddleSubscriptionId: subscriptionResult.data.paddleSubscriptionId,
    status: subscriptionResult.data.status,
    planTier: subscriptionResult.data.planTier,
    departureReason
  })

  if (!refundResult.ok) {
    const isMissingApiKey = refundResult.reason === 'missing_sweego_api_key'
    const isEmailChannelDisabled =
      refundResult.reason === 'sweego_email_channel_disabled'
    const failureStatusCode = isMissingApiKey ? 500 : 400
    const failureErrorCode = isMissingApiKey
      ? 'missing_sweego_api_key'
      : isEmailChannelDisabled
        ? 'sweego_email_channel_disabled'
        : 'refund_failed'

    emitApiLog({
      level: 'error',
      event: 'billing_refund_failed',
      message: 'Refund request failed on provider call',
      context,
      statusCode: failureStatusCode,
      durationMs: getDurationMs(startedAt),
      errorCode: failureErrorCode,
      attributes: {
        refund_reason: refundResult.reason,
        provider_status: refundResult.providerStatus ?? -1,
        provider_error_excerpt:
          refundResult.providerErrorExcerpt ?? refundResult.error
      }
    })
    if (isAjax) {
      return actionJsonError(
        { ok: false, code: 'refund_failed' },
        failureStatusCode
      )
    }
    return redirect(addFlashParam(redirectTo, 'billing_error', 'refund_failed'))
  }

  emitApiLog({
    level: 'info',
    event: 'billing_refund_succeeded',
    message: 'Refund request sent',
    context,
    statusCode: 200,
    durationMs: getDurationMs(startedAt)
  })
  if (isAjax) {
    return actionJsonSuccess({ ok: true, code: 'ok' }, 200)
  }
  return redirect(addFlashParam(redirectTo, 'billing', 'refund_requested'))
}
