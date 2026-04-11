import { createClient } from '@supabase/supabase-js'
import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAppEnv } from './env'

export type SupabaseEnv = {
  SUPABASE_URL?: string
  SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

type AstroCookies = {
  set: (name: string, value: string, options?: { path?: string }) => void
  delete?: (name: string, options?: { path?: string }) => void
}

function readSupabaseEnv(locals: unknown): SupabaseEnv {
  return {
    SUPABASE_URL: readAppEnv('SUPABASE_URL', locals),
    SUPABASE_PUBLISHABLE_DEFAULT_KEY: readAppEnv(
      'SUPABASE_PUBLISHABLE_DEFAULT_KEY',
      locals
    ),
    SUPABASE_SERVICE_ROLE_KEY: readAppEnv('SUPABASE_SERVICE_ROLE_KEY', locals)
  }
}

function listMissingEnv(
  env: SupabaseEnv,
  requiredKeys: Array<keyof SupabaseEnv>
): string[] {
  return requiredKeys.filter((key) => {
    const value = env[key]
    return typeof value !== 'string' || value.trim() === ''
  })
}

/**
 * Admin client – server only. Uses service_role key for auth.admin (e.g. deleteUser).
 * Never expose this client or the service role key to the browser.
 */
export function getSupabaseAdmin(locals: unknown): SupabaseClient | null {
  const env = readSupabaseEnv(locals)
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return null
  }
  return createClient(url, key)
}

/** Public server client – no session cookies, used for server-side auth flows like magic links. */
export function getSupabasePublic(locals: unknown): SupabaseClient | null {
  const env = readSupabaseEnv(locals)
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_PUBLISHABLE_DEFAULT_KEY
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
  const env = readSupabaseEnv(locals)
  const url = env?.SUPABASE_URL
  const key = env?.SUPABASE_PUBLISHABLE_DEFAULT_KEY
  if (!url || !key) {
    const missing = listMissingEnv(env, [
      'SUPABASE_URL',
      'SUPABASE_PUBLISHABLE_DEFAULT_KEY'
    ])
    throw new Error(
      `Supabase env vars missing: ${missing.join(', ')}. Checked Cloudflare bindings and process.env.`
    )
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
