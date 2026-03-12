import type { APIRoute } from 'astro'
import { getSupabaseServer } from '../../../lib/supabase'
import { createSupabaseProgressRepository } from '../../../lib/progress/server'
import {
  createApiLogContext,
  emitApiLog,
  getDurationMs,
  startTimer
} from '../../../lib/observability/otel'
import { getSafeLocalRedirectTarget } from '../../../lib/redirects'

/**
 * GET /api/progress/complete
 * - lessonId=xxx&redirect=/path : marks lesson completed, then redirects.
 * - type=task&targetId=groupId/taskId&redirect=/path : marks task completed, then redirects (e.g. to task complete page).
 * If not authenticated, redirects without marking.
 */
export const GET: APIRoute = async ({
  url,
  request,
  cookies,
  redirect,
  locals
}) => {
  const startedAt = startTimer()
  const baseContext = createApiLogContext({
    request,
    route: '/api/progress/complete',
    locals
  })
  const lessonId = url.searchParams.get('lessonId')
  const type = url.searchParams.get('type')
  const targetId = url.searchParams.get('targetId')
  const redirectParam = url.searchParams.get('redirect')
  const redirectTo = getSafeLocalRedirectTarget(redirectParam, '')

  if (redirectTo === '') {
    emitApiLog({
      level: 'warn',
      event: 'progress_complete_failed',
      message: 'Progress completion failed: invalid redirect',
      context: baseContext,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'invalid_redirect'
    })
    return new Response('Missing or invalid redirect', { status: 400 })
  }

  const isTask = type === 'task' && targetId
  if (!lessonId && !isTask) {
    emitApiLog({
      level: 'warn',
      event: 'progress_complete_failed',
      message: 'Progress completion failed: missing target',
      context: baseContext,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'missing_target'
    })
    return new Response('Missing lessonId or type=task&targetId', {
      status: 400
    })
  }
  if (lessonId && isTask) {
    emitApiLog({
      level: 'warn',
      event: 'progress_complete_failed',
      message: 'Progress completion failed: conflicting params',
      context: baseContext,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'conflicting_target'
    })
    return new Response('Use either lessonId or type=task&targetId', {
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
    } else if (isTask && targetId) {
      await repo.addCompletedItem(user.id, 'task', targetId)
    }
    emitApiLog({
      level: 'info',
      event: 'progress_complete_succeeded',
      message: 'Progress completion succeeded',
      context: userContext,
      statusCode: 302,
      durationMs: getDurationMs(startedAt)
    })
  } else {
    emitApiLog({
      level: 'warn',
      event: 'progress_complete_skipped',
      message: 'Progress completion skipped: unauthenticated user',
      context: baseContext,
      statusCode: 302,
      durationMs: getDurationMs(startedAt),
      errorCode: 'unauthorized'
    })
  }

  return redirect(redirectTo)
}
