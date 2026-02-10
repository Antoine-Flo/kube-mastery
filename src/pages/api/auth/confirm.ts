import type { APIRoute } from 'astro'
import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader
} from '@supabase/ssr'

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

type CookieToSet = { name: string; value: string; options: Record<string, unknown> }

function redirectWithCookies(
  location: string,
  cookiesToSet: CookieToSet[]
): Response {
  const response = Response.redirect(location, 302)
  for (const { name, value, options } of cookiesToSet) {
    const serialized = serializeCookieHeader(name, value, options as Parameters<typeof serializeCookieHeader>[2])
    response.headers.append('Set-Cookie', serialized)
  }
  return response
}

export const GET: APIRoute = async ({ url, request, redirect, locals }) => {
  const lang = url.searchParams.get('lang') || 'en'
  const rawRedirect = url.searchParams.get('redirect') ?? ''
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.includes('//') ? rawRedirect : ''
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')

  if (!tokenHash || type !== 'email') {
    return redirect(
      authErrorRedirect(lang, { messageKey: USER_FRIENDLY_MESSAGE_KEY }, redirectTo)
    )
  }

  const env = (locals as { runtime?: { env?: Record<string, string | undefined> } })?.runtime?.env ?? {}
  const supabaseUrl = env?.SUPABASE_URL
  const supabaseKey = env?.SUPABASE_PUBLISHABLE_DEFAULT_KEY
  if (!supabaseUrl || !supabaseKey) {
    return json(
      { error: 'auth/config', message: 'Missing Supabase env.' },
      500
    )
  }

  const cookieHeader = request.headers.get('Cookie') ?? ''
  const cookiesToSet: CookieToSet[] = []

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(cookieHeader).map((c) => ({
          name: c.name,
          value: c.value ?? ''
        }))
      },
      setAll(cookies: CookieToSet[]) {
        cookiesToSet.push(...cookies)
      }
    }
  })

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email'
  })

  if (error) {
    return redirect(
      authErrorRedirect(lang, { messageKey: USER_FRIENDLY_MESSAGE_KEY }, redirectTo)
    )
  }

  const session = data?.session
  if (!session?.access_token || !session?.refresh_token) {
    return redirect(
      authErrorRedirect(lang, { messageKey: USER_FRIENDLY_MESSAGE_KEY }, redirectTo)
    )
  }

  const location = redirectTo || `/${lang}/courses`
  return redirectWithCookies(location, cookiesToSet)
}
