import type { APIRoute } from 'astro'
import { getSupabaseServer, getSupabaseAdmin } from '../../../lib/supabase'
import { reconcileBillingForAuthenticatedUser } from '../../../lib/auth/reconcile-billing'
import { getSafeLocalRedirectTarget } from '../../../lib/redirects'
import { coerceUiLang } from '../../../i18n/utils'
import { readAppEnv } from '../../../lib/env'
import {
  EARLY_ACCESS_CAP,
  getAuthUserCount,
  ensureEarlyAccessSubscription
} from '../../../lib/auth/early-access-cap'
import {
  createApiLogContext,
  emitApiLog,
  getDurationMs,
  startTimer
} from '../../../lib/observability/otel'

const json = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

function authErrorRedirect(
  lang: string,
  opts: { message?: string; messageKey?: string },
  redirectTo: string
) {
  const base = `/${lang}/auth`
  const params = new URLSearchParams()
  params.set('auth_error', '1')
  if (opts.messageKey) {
    params.set('message_key', opts.messageKey)
  }
  if (opts.message) {
    params.set('message', opts.message)
  }
  if (redirectTo) {
    params.set('redirect', redirectTo)
  }
  return `${base}?${params.toString()}`
}

const USER_FRIENDLY_MESSAGE_KEY = 'auth_oauthErrorTryLater'

export const GET: APIRoute = async ({
  url,
  request,
  cookies,
  redirect,
  locals
}) => {
  const startedAt = startTimer()
  const baseContext = createApiLogContext({
    request,
    route: '/api/auth/callback',
    locals
  })
  const lang = coerceUiLang(url.searchParams.get('lang'))
  const rawRedirect = url.searchParams.get('redirect') ?? ''
  const redirectTo = getSafeLocalRedirectTarget(rawRedirect, '')

  const authCode = url.searchParams.get('code')
  const oauthError = url.searchParams.get('error')
  const oauthErrorDescription = url.searchParams.get('error_description')

  if (oauthError || oauthErrorDescription) {
    emitApiLog({
      level: 'warn',
      event: 'auth_callback_failed',
      message: 'OAuth callback contains provider error',
      context: baseContext,
      statusCode: 302,
      durationMs: getDurationMs(startedAt),
      errorCode: 'auth_oauth_failed'
    })
    return redirect(
      authErrorRedirect(
        lang,
        { messageKey: USER_FRIENDLY_MESSAGE_KEY },
        redirectTo
      )
    )
  }

  if (!authCode) {
    emitApiLog({
      level: 'warn',
      event: 'auth_callback_failed',
      message: 'OAuth callback missing code',
      context: baseContext,
      statusCode: 302,
      durationMs: getDurationMs(startedAt),
      errorCode: 'auth_oauth_failed'
    })
    return redirect(
      authErrorRedirect(
        lang,
        { messageKey: USER_FRIENDLY_MESSAGE_KEY },
        redirectTo
      )
    )
  }

  let supabase
  try {
    supabase = getSupabaseServer(locals, request, cookies)
  } catch (e) {
    emitApiLog({
      level: 'error',
      event: 'auth_callback_failed',
      message: 'OAuth callback missing auth configuration',
      context: baseContext,
      statusCode: 500,
      durationMs: getDurationMs(startedAt),
      errorCode: 'auth_config'
    })
    return json(
      {
        error: 'auth/config',
        message: e instanceof Error ? e.message : 'Missing Supabase env.'
      },
      500
    )
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(authCode)

  if (error) {
    emitApiLog({
      level: 'warn',
      event: 'auth_callback_failed',
      message: 'OAuth callback exchange code failed',
      context: baseContext,
      statusCode: 302,
      durationMs: getDurationMs(startedAt),
      errorCode: 'auth_oauth_failed'
    })
    return redirect(
      authErrorRedirect(
        lang,
        { messageKey: USER_FRIENDLY_MESSAGE_KEY },
        redirectTo
      )
    )
  }

  const session = data?.session
  if (!session?.access_token || !session?.refresh_token) {
    emitApiLog({
      level: 'warn',
      event: 'auth_callback_failed',
      message: 'OAuth callback missing session tokens',
      context: baseContext,
      statusCode: 302,
      durationMs: getDurationMs(startedAt),
      errorCode: 'auth_session_missing'
    })
    return redirect(
      authErrorRedirect(
        lang,
        { messageKey: USER_FRIENDLY_MESSAGE_KEY },
        redirectTo
      )
    )
  }

  const isEarlyStage =
    readAppEnv('EARLY_STAGE', locals)?.toLowerCase().trim() === 'true'
  if (isEarlyStage) {
    const count = await getAuthUserCount(locals)
    if (count != null && count > EARLY_ACCESS_CAP) {
      const admin = getSupabaseAdmin(locals)
      if (admin != null) {
        await admin.auth.admin.deleteUser(session.user.id)
      }
      return redirect(
        authErrorRedirect(
          lang,
          { messageKey: 'auth_registrations_closed' },
          redirectTo
        )
      )
    }
    await ensureEarlyAccessSubscription(locals, session.user.id)
  }

  await reconcileBillingForAuthenticatedUser(locals, data?.user)
  const successContext = createApiLogContext({
    request,
    route: '/api/auth/callback',
    locals,
    userId: data?.user?.id
  })
  emitApiLog({
    level: 'info',
    event: 'auth_callback_succeeded',
    message: 'OAuth callback succeeded',
    context: successContext,
    statusCode: 302,
    durationMs: getDurationMs(startedAt)
  })

  return redirect(redirectTo || `/${lang}/courses`)
}
