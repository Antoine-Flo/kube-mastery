import type { APIRoute } from 'astro'
import { getSupabaseServer } from '../../../lib/supabase'
import { createSupabaseProgressRepository } from '../../../lib/progress/server'
import {
  createApiLogContext,
  emitApiLog,
  getDurationMs,
  startTimer
} from '../../../lib/observability/otel'

/**
 * POST /api/progress/complete
 * JSON body: { lessonId: string } OR { type: "drill", targetId: string }
 * Legacy: { type: "task", targetId } is accepted and stored as drill.
 * Returns 204. Does not redirect. Unauthenticated requests get 204 with no write.
 */
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const startedAt = startTimer()
  const baseContext = createApiLogContext({
    request,
    route: '/api/progress/complete',
    locals
  })

  let parsed: unknown
  try {
    parsed = await request.json()
  } catch {
    emitApiLog({
      level: 'warn',
      event: 'progress_complete_failed',
      message: 'Progress completion failed: invalid JSON',
      context: baseContext,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'invalid_json'
    })
    return new Response('Invalid JSON', { status: 400 })
  }

  if (!parsed || typeof parsed !== 'object') {
    emitApiLog({
      level: 'warn',
      event: 'progress_complete_failed',
      message: 'Progress completion failed: invalid body',
      context: baseContext,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'invalid_body'
    })
    return new Response('Invalid body', { status: 400 })
  }

  const body = parsed as Record<string, unknown>
  const lessonId = typeof body.lessonId === 'string' ? body.lessonId : undefined
  const bodyType = body.type
  const isDrillCompletion =
    bodyType === 'drill' || bodyType === 'task'
  const targetId = typeof body.targetId === 'string' ? body.targetId : undefined

  if (!lessonId && !(isDrillCompletion && targetId)) {
    emitApiLog({
      level: 'warn',
      event: 'progress_complete_failed',
      message: 'Progress completion failed: missing target',
      context: baseContext,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'missing_target'
    })
    return new Response('Missing lessonId or type drill with targetId', {
      status: 400
    })
  }

  if (lessonId && isDrillCompletion) {
    emitApiLog({
      level: 'warn',
      event: 'progress_complete_failed',
      message: 'Progress completion failed: conflicting params',
      context: baseContext,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'conflicting_target'
    })
    return new Response('Use either lessonId or drill completion with targetId', {
      status: 400
    })
  }

  const supabase = getSupabaseServer(locals, request, cookies)
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (user) {
    const userContext = createApiLogContext({
      request,
      route: '/api/progress/complete',
      locals,
      userId: user.id
    })
    const repo = createSupabaseProgressRepository(supabase)
    if (lessonId) {
      await repo.addCompletedItem(user.id, 'lesson', lessonId)
    } else if (isDrillCompletion && targetId) {
      await repo.addCompletedItem(user.id, 'drill', targetId)
    }
    emitApiLog({
      level: 'info',
      event: 'progress_complete_succeeded',
      message: 'Progress completion succeeded',
      context: userContext,
      statusCode: 204,
      durationMs: getDurationMs(startedAt)
    })
  } else {
    emitApiLog({
      level: 'warn',
      event: 'progress_complete_skipped',
      message: 'Progress completion skipped: unauthenticated user',
      context: baseContext,
      statusCode: 204,
      durationMs: getDurationMs(startedAt),
      errorCode: 'unauthorized'
    })
  }

  return new Response(null, { status: 204 })
}
