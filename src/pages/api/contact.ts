import type { APIRoute } from 'astro'
import { getSupabaseServer } from '../../lib/supabase'

const CONTACT_TYPES = ['support', 'suggestion', 'other'] as const

/**
 * POST /api/contact
 * Body: { type: "support" | "suggestion" | "other", message: string, lessonId?: string }
 * Inserts into messages. User must be authenticated.
 */
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  let body: { type?: string; message?: string; lessonId?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const type = body.type
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (
    !type ||
    !CONTACT_TYPES.includes(type as (typeof CONTACT_TYPES)[number])
  ) {
    return new Response(
      JSON.stringify({
        error: 'Invalid or missing type (support, suggestion, other)'
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const supabase = getSupabaseServer(locals, request, cookies)
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const { error: insertError } = await supabase.from('messages').insert({
    type,
    lesson_id:
      typeof body.lessonId === 'string' && body.lessonId.trim()
        ? body.lessonId.trim()
        : null,
    content: { message },
    user_id: user.id
  })

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
