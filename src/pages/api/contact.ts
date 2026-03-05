import type { APIRoute } from 'astro'
import { getSupabaseServer } from '../../lib/supabase'
import {
  createApiLogContext,
  emitApiLog,
  getDurationMs,
  startTimer
} from '../../lib/observability/otel'

const CONTACT_TYPES = ['support', 'suggestion', 'other'] as const

/**
 * POST /api/contact
 * Body: { type: "support" | "suggestion" | "other", message: string, lessonId?: string }
 * Inserts into messages. User must be authenticated.
 */
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const startedAt = startTimer()
  const baseContext = createApiLogContext({
    request,
    route: '/api/contact',
    locals
  })
  let body: { type?: string; message?: string; lessonId?: string }
  try {
    body = await request.json()
  } catch {
    emitApiLog({
      level: 'warn',
      event: 'contact_submit_failed',
      message: 'Contact submit failed: invalid JSON body',
      context: baseContext,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'invalid_json'
    })
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
    emitApiLog({
      level: 'warn',
      event: 'contact_submit_failed',
      message: 'Contact submit failed: invalid type',
      context: baseContext,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'invalid_type'
    })
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
    emitApiLog({
      level: 'warn',
      event: 'contact_submit_failed',
      message: 'Contact submit failed: message missing',
      context: baseContext,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'message_required'
    })
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
    emitApiLog({
      level: 'warn',
      event: 'contact_submit_failed',
      message: 'Contact submit unauthorized',
      context: baseContext,
      statusCode: 401,
      durationMs: getDurationMs(startedAt),
      errorCode: 'unauthorized'
    })
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
  const userContext = createApiLogContext({
    request,
    route: '/api/contact',
    locals,
    userId: user.id
  })

  if (insertError) {
    emitApiLog({
      level: 'error',
      event: 'contact_submit_failed',
      message: 'Contact submit failed on insert',
      context: userContext,
      statusCode: 500,
      durationMs: getDurationMs(startedAt),
      errorCode: 'insert_failed'
    })
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  emitApiLog({
    level: 'info',
    event: 'contact_submit_succeeded',
    message: 'Contact submit succeeded',
    context: userContext,
    statusCode: 200,
    durationMs: getDurationMs(startedAt)
  })
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
