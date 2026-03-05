import type { APIRoute } from 'astro'
import { deleteCurrentUserAccount } from '../../../lib/auth/server'
import {
  actionJsonError,
  actionJsonSuccess,
  isAjaxFormAction
} from '../../../lib/form-action-server'

function getSafeRedirectTarget(
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

export const POST: APIRoute = async ({
  url,
  cookies,
  redirect,
  locals,
  request
}) => {
  const isAjax = isAjaxFormAction(request)
  const redirectTo = getSafeRedirectTarget(
    url.searchParams.get('redirect'),
    '/en'
  )

  const result = await deleteCurrentUserAccount({ locals, request, cookies })

  if (result.ok) {
    if (isAjax) {
      return actionJsonSuccess({ ok: true, code: 'ok', redirectTo }, 200)
    }
    return redirect(redirectTo)
  }

  if (result.reason === 'not_authenticated') {
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'unauthorized' }, 401)
    }
    return redirect(redirectTo)
  }

  if (result.reason === 'admin_missing') {
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'action_failed' }, 500)
    }
    const redirectWithError = `${redirectTo}?account_error=delete_failed`
    return redirect(redirectWithError)
  }

  if (result.reason === 'subscription_active') {
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'subscription_active' }, 409)
    }
    const redirectWithError = `${redirectTo}?account_error=subscription_active`
    return redirect(redirectWithError)
  }

  if (isAjax) {
    return actionJsonError({ ok: false, code: 'delete_failed' }, 400)
  }
  const redirectWithError = `${redirectTo}?account_error=delete_failed`
  return redirect(redirectWithError)
}
