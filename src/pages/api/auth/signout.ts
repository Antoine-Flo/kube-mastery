import type { APIRoute } from 'astro'
import { getSupabaseServer } from '../../../lib/supabase'
import { coerceUiLang } from '../../../i18n/utils'

export const GET: APIRoute = async ({
  url,
  cookies,
  redirect,
  locals,
  request
}) => {
  const lang = coerceUiLang(url.searchParams.get('lang'))
  try {
    const supabase = getSupabaseServer(locals, request, cookies)
    await supabase.auth.signOut()
  } catch {
    // Supabase env missing or other error, still redirect
  }
  return redirect(`/${lang}`)
}
