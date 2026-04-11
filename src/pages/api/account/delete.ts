import type { APIRoute } from 'astro'
import { deleteCurrentUserAccount } from '../../../lib/auth/server'
import {
  addFlashParam,
  getSafeRedirectTarget
} from '../../../lib/billing/account-actions'
import {
  actionJsonError,
  actionJsonSuccess,
  isAjaxFormAction
} from '../../../lib/form-action-server'
import {
  createApiLogContext,
  emitApiLog,
  getDurationMs,
  startTimer
} from '../../../lib/api-log'

export const POST: APIRoute = async ({
  url,
  cookies,
  redirect,
  locals,
  request
}) => {
  const startedAt = startTimer()
  const baseContext = createApiLogContext({
    request,
    route: '/api/account/delete',
    locals
  })
  const isAjax = isAjaxFormAction(request)
  const redirectTo = getSafeRedirectTarget(
    url.searchParams.get('redirect'),
    '/en'
  )

  const result = await deleteCurrentUserAccount({ locals, request, cookies })

  if (result.ok) {
    emitApiLog({
      level: 'info',
      event: 'account_delete_succeeded',
      message: 'Account deletion succeeded',
      context: baseContext,
      statusCode: 200,
      durationMs: getDurationMs(startedAt)
    })
    if (isAjax) {
      return actionJsonSuccess({ ok: true, code: 'ok', redirectTo }, 200)
    }
    return redirect(redirectTo)
  }

  if (result.reason === 'not_authenticated') {
    emitApiLog({
      level: 'warn',
      event: 'account_delete_failed',
      message: 'Account deletion unauthorized',
      context: baseContext,
      statusCode: 401,
      durationMs: getDurationMs(startedAt),
      errorCode: 'unauthorized'
    })
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'unauthorized' }, 401)
    }
    return redirect(redirectTo)
  }

  if (result.reason === 'admin_missing') {
    emitApiLog({
      level: 'error',
      event: 'account_delete_failed',
      message: 'Account deletion missing admin client',
      context: baseContext,
      statusCode: 500,
      durationMs: getDurationMs(startedAt),
      errorCode: 'action_failed'
    })
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'action_failed' }, 500)
    }
    const redirectWithError = addFlashParam(
      redirectTo,
      'account_error',
      'delete_failed'
    )
    return redirect(redirectWithError)
  }

  if (result.reason === 'subscription_active') {
    emitApiLog({
      level: 'warn',
      event: 'account_delete_failed',
      message: 'Account deletion blocked by active subscription',
      context: baseContext,
      statusCode: 409,
      durationMs: getDurationMs(startedAt),
      errorCode: 'subscription_active'
    })
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'subscription_active' }, 409)
    }
    const redirectWithError = addFlashParam(
      redirectTo,
      'account_error',
      'subscription_active'
    )
    return redirect(redirectWithError)
  }

  emitApiLog({
    level: 'error',
    event: 'account_delete_failed',
    message: 'Account deletion failed',
    context: baseContext,
    statusCode: 400,
    durationMs: getDurationMs(startedAt),
    errorCode: 'delete_failed'
  })
  if (isAjax) {
    return actionJsonError({ ok: false, code: 'delete_failed' }, 400)
  }
  const redirectWithError = addFlashParam(
    redirectTo,
    'account_error',
    'delete_failed'
  )
  return redirect(redirectWithError)
}
