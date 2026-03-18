import type { APIRoute } from 'astro'
import { getSupabaseServer } from '../../../lib/supabase'
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

function isEarlyStage(locals: unknown): boolean {
  return (
    readAppEnv('EARLY_ACCESS', locals)?.toLowerCase().trim() === 'true'
  )
}

export const POST: APIRoute = async ({
  request,
  cookies,
  redirect,
  locals
}) => {
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

  const formData = await request.formData()
  const email = formData.get('email')?.toString()
  const password = formData.get('password')?.toString()
  const lang = coerceUiLang(formData.get('lang')?.toString())

  if (!email || !password) {
    return new Response('Email and password are required', { status: 400 })
  }

  if (isEarlyStage(locals)) {
    const count = await getAuthUserCount(locals)
    if (count != null && count >= EARLY_ACCESS_CAP) {
      return json(
        { ok: false, code: 'auth_registrations_closed' },
        503
      )
    }
  }

  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return json({ error: 'auth/register', message: error.message }, 500)
  }

  if (isEarlyStage(locals) && data?.user?.id != null) {
    await ensureEarlyAccessSubscription(locals, data.user.id)
  }

  return redirect(`/${lang}/auth`)
}
