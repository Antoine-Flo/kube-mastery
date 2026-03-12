import type { APIRoute } from 'astro'
import { getSupabaseServer } from '../../../lib/supabase'
import type { Provider } from '@supabase/supabase-js'
import { reconcileBillingForAuthenticatedUser } from '../../../lib/auth/reconcile-billing'
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
} from '../../../lib/observability/otel'
import { getSafeLocalRedirectTarget } from '../../../lib/redirects'
import { coerceUiLang } from '../../../i18n/utils'

function buildAuthErrorRedirect(args: {
  lang: string
  redirectTo: string
  messageKey: string
}): string {
  const params = new URLSearchParams()
  params.set('auth_error', '1')
  params.set('message_key', args.messageKey)
  if (args.redirectTo !== '') {
    params.set('redirect', args.redirectTo)
  }
  return `/${args.lang}/auth?${params.toString()}`
}

export const POST: APIRoute = async ({
  request,
  cookies,
  redirect,
  locals
}) => {
  const startedAt = startTimer()
  const baseContext = createApiLogContext({
    request,
    route: '/api/auth/signin',
    locals
  })
  const isAjax = isAjaxFormAction(request)
  let supabase
  try {
    supabase = getSupabaseServer(locals, request, cookies)
  } catch (e) {
    emitApiLog({
      level: 'error',
      event: 'auth_signin_failed',
      message: 'Sign-in failed: missing auth configuration',
      context: baseContext,
      statusCode: 500,
      durationMs: getDurationMs(startedAt),
      errorCode: 'action_failed'
    })
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'action_failed' }, 500)
    }
    return redirect(
      buildAuthErrorRedirect({
        lang: 'en',
        redirectTo: '',
        messageKey: 'auth_errorUnexpected'
      })
    )
  }

  const formData = await request.formData()
  const email = formData.get('email')?.toString()
  const password = formData.get('password')?.toString()
  const provider = formData.get('provider')?.toString()
  const magic = formData.get('magic')?.toString() === '1'
  const lang = coerceUiLang(formData.get('lang')?.toString())
  const rawRedirect = formData.get('redirect')?.toString() ?? ''
  const redirectTo = getSafeLocalRedirectTarget(rawRedirect, '')

  if (magic && email) {
    const confirmUrl = new URL('/api/auth/confirm', request.url)
    confirmUrl.searchParams.set('lang', lang)
    if (redirectTo) {
      confirmUrl.searchParams.set('redirect', redirectTo)
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: confirmUrl.toString(),
        shouldCreateUser: true
      }
    })
    if (error) {
      emitApiLog({
        level: 'error',
        event: 'auth_signin_failed',
        message: 'Magic link sign-in failed',
        context: baseContext,
        statusCode: 400,
        durationMs: getDurationMs(startedAt),
        errorCode: 'auth_signin_failed'
      })
      if (isAjax) {
        return actionJsonError({ ok: false, code: 'auth_signin_failed' }, 400)
      }
      return redirect(
        buildAuthErrorRedirect({
          lang,
          redirectTo,
          messageKey: 'auth_magicLinkError'
        })
      )
    }
    const checkEmailUrl = `/${lang}/auth/check-email`
    const params = new URLSearchParams()
    if (redirectTo) {
      params.set('redirect', redirectTo)
    }
    const finalRedirect =
      params.toString() !== ''
        ? `${checkEmailUrl}?${params.toString()}`
        : checkEmailUrl
    emitApiLog({
      level: 'info',
      event: 'auth_signin_succeeded',
      message: 'Magic link sign-in initiated',
      context: baseContext,
      statusCode: 200,
      durationMs: getDurationMs(startedAt)
    })
    if (isAjax) {
      return actionJsonSuccess({
        ok: true,
        code: 'ok',
        redirectTo: finalRedirect
      })
    }
    return redirect(finalRedirect)
  }

  const oauthProvider =
    provider === 'github' || provider === 'gitlab'
      ? (provider as Provider)
      : null

  if (oauthProvider !== null) {
    const callbackUrl = new URL('/api/auth/callback', request.url)
    callbackUrl.searchParams.set('lang', lang)
    if (redirectTo) {
      callbackUrl.searchParams.set('redirect', redirectTo)
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: oauthProvider,
      options: { redirectTo: callbackUrl.toString() }
    })
    if (error) {
      emitApiLog({
        level: 'error',
        event: 'auth_signin_failed',
        message: 'OAuth sign-in failed',
        context: baseContext,
        statusCode: 400,
        durationMs: getDurationMs(startedAt),
        errorCode: 'auth_oauth_failed'
      })
      if (isAjax) {
        return actionJsonError({ ok: false, code: 'auth_oauth_failed' }, 400)
      }
      return redirect(
        buildAuthErrorRedirect({
          lang,
          redirectTo,
          messageKey: 'auth_errorUnexpected'
        })
      )
    }
    if (!data?.url) {
      emitApiLog({
        level: 'error',
        event: 'auth_signin_failed',
        message: 'OAuth sign-in failed: missing redirect URL',
        context: baseContext,
        statusCode: 500,
        durationMs: getDurationMs(startedAt),
        errorCode: 'auth_oauth_failed'
      })
      if (isAjax) {
        return actionJsonError({ ok: false, code: 'auth_oauth_failed' }, 500)
      }
      return redirect(
        buildAuthErrorRedirect({
          lang,
          redirectTo,
          messageKey: 'auth_errorUnexpected'
        })
      )
    }
    if (isAjax) {
      return actionJsonSuccess({ ok: true, code: 'ok', redirectTo: data.url })
    }
    emitApiLog({
      level: 'info',
      event: 'auth_signin_succeeded',
      message: 'OAuth sign-in initiated',
      context: baseContext,
      statusCode: 200,
      durationMs: getDurationMs(startedAt)
    })
    return redirect(data.url)
  }

  if (!email || !password) {
    emitApiLog({
      level: 'warn',
      event: 'auth_signin_failed',
      message: 'Sign-in failed: invalid input',
      context: baseContext,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'invalid_input'
    })
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'invalid_input' }, 400)
    }
    return redirect(
      buildAuthErrorRedirect({
        lang,
        redirectTo,
        messageKey: 'auth_errorUnexpected'
      })
    )
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    emitApiLog({
      level: 'warn',
      event: 'auth_signin_failed',
      message: 'Password sign-in failed',
      context: baseContext,
      statusCode: 401,
      durationMs: getDurationMs(startedAt),
      errorCode: 'auth_signin_failed'
    })
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'auth_signin_failed' }, 401)
    }
    return redirect(
      buildAuthErrorRedirect({
        lang,
        redirectTo,
        messageKey: 'auth_errorInvalidCredentials'
      })
    )
  }

  const session = data?.session
  if (!session?.access_token || !session?.refresh_token) {
    emitApiLog({
      level: 'error',
      event: 'auth_signin_failed',
      message: 'Sign-in failed: session missing',
      context: baseContext,
      statusCode: 500,
      durationMs: getDurationMs(startedAt),
      errorCode: 'auth_session_missing'
    })
    if (isAjax) {
      return actionJsonError({ ok: false, code: 'auth_session_missing' }, 500)
    }
    return redirect(
      buildAuthErrorRedirect({
        lang,
        redirectTo,
        messageKey: 'auth_errorUnexpected'
      })
    )
  }

  await reconcileBillingForAuthenticatedUser(locals, data?.user)
  const successRedirect = redirectTo || `/${lang}/courses`
  const successContext = createApiLogContext({
    request,
    route: '/api/auth/signin',
    locals,
    userId: data?.user?.id
  })
  emitApiLog({
    level: 'info',
    event: 'auth_signin_succeeded',
    message: 'Sign-in succeeded',
    context: successContext,
    statusCode: 200,
    durationMs: getDurationMs(startedAt)
  })
  if (isAjax) {
    return actionJsonSuccess({
      ok: true,
      code: 'ok',
      redirectTo: successRedirect
    })
  }
  return redirect(successRedirect)
}
