import type { APIRoute } from 'astro'
import { getSupabaseServer } from '../../../lib/supabase'
import type { Provider } from '@supabase/supabase-js'
import { reconcileBillingForAuthenticatedUser } from '../../../lib/auth/reconcile-billing'
import {
  actionJsonError,
  actionJsonSuccess,
  isAjaxFormAction
} from '../../../lib/form-action-server'

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
  const isAjax = isAjaxFormAction(request)
  let supabase
  try {
    supabase = getSupabaseServer(locals, request, cookies)
  } catch (e) {
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
  const lang = (formData.get('lang')?.toString() || 'en') as string
  const rawRedirect = formData.get('redirect')?.toString() ?? ''
  const redirectTo =
    rawRedirect.startsWith('/') && !rawRedirect.includes('//')
      ? rawRedirect
      : ''

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
    if (isAjax) {
      return actionJsonSuccess({ ok: true, code: 'ok', redirectTo: finalRedirect })
    }
    return redirect(finalRedirect)
  }

  if (provider === 'github') {
    const callbackUrl = new URL('/api/auth/callback', request.url)
    callbackUrl.searchParams.set('lang', lang)
    if (redirectTo) {
      callbackUrl.searchParams.set('redirect', redirectTo)
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github' as Provider,
      options: { redirectTo: callbackUrl.toString() }
    })
    if (error) {
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
    return redirect(data.url)
  }

  if (!email || !password) {
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
  if (isAjax) {
    return actionJsonSuccess({ ok: true, code: 'ok', redirectTo: successRedirect })
  }
  return redirect(successRedirect)
}
