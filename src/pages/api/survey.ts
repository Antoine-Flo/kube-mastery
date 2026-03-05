import type { APIRoute } from 'astro'
import { getSupabaseServer } from '../../lib/supabase'
import {
  createApiLogContext,
  emitApiLog,
  getDurationMs,
  startTimer
} from '../../lib/observability/otel'

const SURVEY_NAMES = ['small', 'task'] as const
const MIN_RATING = 1
const MAX_RATING = 5

/**
 * POST /api/survey
 * Body: { name: 'small' | 'task', rating: number (1-5), comment?: string, taskId?: string (for name=task) }
 * Inserts into messages (type survey). User must be authenticated.
 */
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const startedAt = startTimer()
  const baseContext = createApiLogContext({
    request,
    route: '/api/survey',
    locals
  })
  let body: {
    name?: string
    rating?: number
    comment?: string
    taskId?: string
  }
  try {
    body = await request.json()
  } catch {
    emitApiLog({
      level: 'warn',
      event: 'survey_submit_failed',
      message: 'Survey submit failed: invalid JSON body',
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

  const name = body.name
  if (!name || !SURVEY_NAMES.includes(name as (typeof SURVEY_NAMES)[number])) {
    emitApiLog({
      level: 'warn',
      event: 'survey_submit_failed',
      message: 'Survey submit failed: invalid name',
      context: baseContext,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'invalid_name'
    })
    return new Response(
      JSON.stringify({ error: 'Invalid or missing name (e.g. small)' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  const rating =
    typeof body.rating === 'number' ? body.rating : Number(body.rating)
  if (!Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    emitApiLog({
      level: 'warn',
      event: 'survey_submit_failed',
      message: 'Survey submit failed: invalid rating',
      context: baseContext,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'invalid_rating'
    })
    return new Response(
      JSON.stringify({
        error: `Rating must be between ${MIN_RATING} and ${MAX_RATING}`
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  const supabase = getSupabaseServer(locals, request, cookies)
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()
  if (userError || !user) {
    emitApiLog({
      level: 'warn',
      event: 'survey_submit_failed',
      message: 'Survey submit unauthorized',
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

  const comment =
    typeof body.comment === 'string' ? body.comment.trim() : undefined
  const content =
    comment !== undefined && comment !== '' ? { rating, comment } : { rating }
  const lessonId =
    name === 'task' && typeof body.taskId === 'string' && body.taskId.trim()
      ? body.taskId.trim()
      : null

  const { error: insertError } = await supabase.from('messages').insert({
    type: 'survey',
    name,
    content,
    user_id: user.id,
    lesson_id: lessonId
  })
  const userContext = createApiLogContext({
    request,
    route: '/api/survey',
    locals,
    userId: user.id
  })

  if (insertError) {
    emitApiLog({
      level: 'error',
      event: 'survey_submit_failed',
      message: 'Survey submit failed on insert',
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
    event: 'survey_submit_succeeded',
    message: 'Survey submit succeeded',
    context: userContext,
    statusCode: 200,
    durationMs: getDurationMs(startedAt)
  })
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
