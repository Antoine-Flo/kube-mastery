import { createClient } from '@supabase/supabase-js'
import {
  createBrowserClient,
  createServerClient,
  parseCookieHeader
} from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

export type SupabaseEnv = {
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

/** Browser client – use in <script> in .astro pages. Needs PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env (same values as server vars for local dev). */
export function createSupabaseBrowserClient(): SupabaseClient {
  const url = import.meta.env.PUBLIC_SUPABASE_URL
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  if (!url || !key) {
    throw new Error(
      'Supabase client: set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY (or PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) in .env.'
    )
  }
  return createBrowserClient(url, key)
}

type AstroCookies = {
  set: (name: string, value: string, options?: { path?: string }) => void
  delete?: (name: string, options?: { path?: string }) => void
}

/**
 * Admin client – server only. Uses service_role key for auth.admin (e.g. deleteUser).
 * Never expose this client or the service role key to the browser.
 */
export function getSupabaseAdmin(locals: unknown): SupabaseClient | null {
  const env =
    (locals as { runtime?: { env?: SupabaseEnv } })?.runtime?.env ?? {}
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return null
  }
  return createClient(url, key)
}

/** Server client – use in API routes and server-rendered pages. Cookies = PKCE verifier + session. */
export function getSupabaseServer(
  locals: unknown,
  request: Request,
  cookies: AstroCookies
): SupabaseClient {
  const env = (locals as any).runtime?.env ?? {}
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_PUBLISHABLE_DEFAULT_KEY
  if (!url || !key) {
    throw new Error('Supabase env vars missing.')
  }
  const cookieHeader = request.headers.get('Cookie') ?? ''

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return parseCookieHeader(cookieHeader).map((c) => ({
          name: c.name,
          value: c.value ?? ''
        }))
      },
      setAll(cookiesToSet) {
        // Supabase may call setAll from an async callback after the response has started.
        // Astro then warns and throws. Avoid spamming the console with the known warning.
        const astroCookiesWarning =
          'Astro.cookies.set() was called after the cookies had already been sent'
        const origWarn = console.warn
        console.warn = (...args: unknown[]) => {
          const msg = args[0]?.toString?.() ?? ''
          if (msg.includes(astroCookiesWarning)) {
            return
          }
          origWarn.apply(console, args)
        }
        try {
          cookiesToSet.forEach(({ name, value }) => {
            if (value === '' && cookies.delete) {
              cookies.delete(name, { path: '/' })
            } else {
              cookies.set(name, value, { path: '/' })
            }
          })
        } catch (err) {
          if (err == null || (err as Error).name !== 'ResponseSentError') {
            throw err
          }
        } finally {
          console.warn = origWarn
        }
      }
    }
  })
}
