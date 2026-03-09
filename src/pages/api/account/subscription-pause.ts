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
import { pausePaddleSubscription } from '../../../lib/billing/provisioning'
import {
  createApiLogContext,
  emitApiLog,
  getDurationMs,
  startTimer
} from '../../../lib/observability/otel'
import { getSupabaseServer } from '../../../lib/supabase'

export const POST: APIRoute = async ({
  request,
  cookies,
  locals,
  url,
  redirect
}) => {
  const startedAt = startTimer()
  const baseContext = createApiLogContext({
    request,
    route: '/api/account/subscription-pause',
    locals
  })
  const isAjax = isAjaxFormAction(request)
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
      event: 'billing_pause_failed',
      message: 'Pause subscription unauthorized',
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
    route: '/api/account/subscription-pause',
    locals,
    userId: user.id
  })
  if (subscriptionResult.error != null) {
    emitApiLog({
      level: 'error',
      event: 'billing_pause_failed',
      message: 'Pause subscription failed during lookup',
      context,
      statusCode: 500,
      durationMs: getDurationMs(startedAt),
      errorCode: 'action_failed'
    })
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'action_failed' }, 500)
    }
    return redirect(addFlashParam(redirectTo, 'billing_error', 'pause_failed'))
  }

  if (subscriptionResult.data == null) {
    emitApiLog({
      level: 'warn',
      event: 'billing_pause_failed',
      message: 'Pause subscription failed: subscription not found',
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

  const pauseResult = await pausePaddleSubscription({
    locals,
    paddleSubscriptionId: subscriptionResult.data.paddleSubscriptionId
  })
  if (!pauseResult.ok) {
    emitApiLog({
      level: 'error',
      event: 'billing_pause_failed',
      message: 'Pause subscription failed on provider call',
      context,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'pause_failed'
    })
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'pause_failed' }, 400)
    }
    return redirect(addFlashParam(redirectTo, 'billing_error', 'pause_failed'))
  }

  emitApiLog({
    level: 'info',
    event: 'billing_pause_succeeded',
    message: 'Pause subscription succeeded',
    context,
    statusCode: 200,
    durationMs: getDurationMs(startedAt)
  })
  if (isAjax) {
    return actionJsonSuccess({ ok: true, code: 'ok' }, 200)
  }
  return redirect(addFlashParam(redirectTo, 'billing', 'paused'))
}
