import type { APIRoute } from 'astro'
import { getSupabaseServer } from '../../../lib/supabase'

export const GET: APIRoute = async ({ url, cookies, redirect, locals, request }) => {
  const lang = url.searchParams.get('lang') || 'en'
  try {
    const supabase = getSupabaseServer(locals, request, cookies)
    await supabase.auth.signOut()
  } catch {
    // Supabase env missing or other error — still redirect
  }
  return redirect(`/${lang}`)
}
