import type { APIRoute } from 'astro'
import { getSupabaseServer } from '../../../lib/supabase'

/**
 * POST /api/account/preferences
 * Body: { locale: 'en' | 'fr' }
 * Updates the authenticated user's default locale in preferences.
 */
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const supabase = getSupabaseServer(locals, request, cookies)
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  let body: { locale?: string }
  try {
    body = (await request.json()) as { locale?: string }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const locale = body.locale === 'fr' ? 'fr' : body.locale === 'en' ? 'en' : undefined
  if (locale === undefined) {
    return new Response(JSON.stringify({ error: 'Invalid locale' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const { error } = await supabase
    .from('preferences')
    .upsert(
      {
        user_id: user.id,
        locale,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
