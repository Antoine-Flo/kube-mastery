import type { APIRoute } from 'astro'
import { getSupabaseServer } from '../../../lib/supabase'
import type { Provider } from '@supabase/supabase-js'
import { reconcileBillingForAuthenticatedUser } from '../../../lib/auth/reconcile-billing'
import { CONFIG } from '../../../config'
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
  rawMessage?: string
}): string {
  const params = new URLSearchParams()
  params.set('auth_error', '1')
  params.set('message_key', args.messageKey)
  if (args.rawMessage != null && args.rawMessage.trim() !== '') {
    params.set('message', args.rawMessage)
  }
  if (args.redirectTo !== '') {
    params.set('redirect', args.redirectTo)
  }
  return `/${args.lang}/auth?${params.toString()}`
}

const magicLinkRateLimitStore = new Map<
  string,
  { count: number; windowStartedAt: number }
>()

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor != null && forwardedFor.trim() !== '') {
    const firstIp = forwardedFor.split(',')[0]
    const normalizedIp = firstIp.trim()
    if (normalizedIp !== '') {
      return normalizedIp
    }
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp != null && realIp.trim() !== '') {
    return realIp.trim()
  }

  return null
}

function getMagicLinkRateLimitKey(clientIp: string | null): string {
  if (clientIp != null && clientIp !== '') {
    return `ip:${clientIp}`
  }

  return 'ip:unknown'
}

function isMagicLinkRateLimited(args: {
  key: string
  now: number
  windowMs: number
  maxRequests: number
}): boolean {
  const current = magicLinkRateLimitStore.get(args.key)
  if (current == null) {
    magicLinkRateLimitStore.set(args.key, {
      count: 1,
      windowStartedAt: args.now
    })
    return false
  }

  if (args.now - current.windowStartedAt >= args.windowMs) {
    magicLinkRateLimitStore.set(args.key, {
      count: 1,
      windowStartedAt: args.now
    })
    return false
  }

  if (current.count >= args.maxRequests) {
    return true
  }

  current.count += 1
  magicLinkRateLimitStore.set(args.key, current)
  return false
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
    const rateLimitNow = Date.now()
    const clientIp = getClientIp(request)
    const rateLimitKey = getMagicLinkRateLimitKey(clientIp)
    const isLimited = isMagicLinkRateLimited({
      key: rateLimitKey,
      now: rateLimitNow,
      windowMs: CONFIG.auth.magicLinkRateLimit.windowMs,
      maxRequests: CONFIG.auth.magicLinkRateLimit.maxRequests
    })
    if (isLimited) {
      emitApiLog({
        level: 'warn',
        event: 'auth_signin_failed',
        message: 'Magic link sign-in failed: rate limit exceeded',
        context: baseContext,
        statusCode: 429,
        durationMs: getDurationMs(startedAt),
        errorCode: 'rate_limited'
      })
      if (isAjax) {
        return actionJsonError({ ok: false, code: 'rate_limited' }, 429)
      }
      return redirect(
        buildAuthErrorRedirect({
          lang,
          redirectTo,
          messageKey: 'auth_magicLinkRateLimited',
          rawMessage:
            'Too many magic link requests. Please wait a few minutes and try again.'
        })
      )
    }

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
    provider === 'github' || provider === 'gitlab' || provider === 'google'
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
