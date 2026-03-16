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

const USER_FRIENDLY_MESSAGE_KEY = 'auth_magicLinkError'

export const GET: APIRoute = async ({
  url,
  request,
  cookies,
  redirect,
  locals
}) => {
  const lang = coerceUiLang(url.searchParams.get('lang'))
  const rawRedirect = url.searchParams.get('redirect') ?? ''
  const redirectTo = getSafeLocalRedirectTarget(rawRedirect, '')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')

  if (!tokenHash || type !== 'email') {
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
    return json(
      {
        error: 'auth/config',
        message: e instanceof Error ? e.message : 'Missing Supabase env.'
      },
      500
    )
  }

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email'
  })

  if (error) {
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

  return redirect(redirectTo || `/${lang}/courses`)
}
