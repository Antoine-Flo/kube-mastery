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
import { getSupabaseServer } from '../../../lib/supabase'

export const POST: APIRoute = async ({
  request,
  cookies,
  locals,
  url,
  redirect
}) => {
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
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'unauthorized' }, 401)
    }
    return redirect(addFlashParam(redirectTo, 'billing_error', 'unauthorized'))
  }

  const subscriptionResult = await getLatestUserSubscriptionForBilling(
    supabase,
    user.id
  )
  if (subscriptionResult.error != null) {
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'action_failed' }, 500)
    }
    return redirect(addFlashParam(redirectTo, 'billing_error', 'pause_failed'))
  }

  if (subscriptionResult.data == null) {
    if (isAjax) {
      return actionJsonError(
        { ok: false, code: 'subscription_not_found' },
        404
      )
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
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'pause_failed' }, 400)
    }
    return redirect(addFlashParam(redirectTo, 'billing_error', 'pause_failed'))
  }

  if (isAjax) {
    return actionJsonSuccess({ ok: true, code: 'ok' }, 200)
  }
  return redirect(addFlashParam(redirectTo, 'billing', 'paused'))
}
