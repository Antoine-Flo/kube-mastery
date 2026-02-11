import type { APIRoute } from 'astro'
import { getSupabaseServer } from '../../../lib/supabase'
import { createSupabaseProgressRepository } from '../../../lib/progress/server'

/**
 * GET /api/progress/complete
 * - lessonId=xxx&redirect=/path : marks lesson completed, then redirects.
 * - type=task&targetId=groupId/taskId&redirect=/path : marks task completed, then redirects (e.g. to task complete page).
 * If not authenticated, redirects without marking.
 */
export const GET: APIRoute = async ({ url, request, cookies, redirect, locals }) => {
  const lessonId = url.searchParams.get('lessonId')
  const type = url.searchParams.get('type')
  const targetId = url.searchParams.get('targetId')
  let redirectTo = url.searchParams.get('redirect')

  if (!redirectTo || !redirectTo.startsWith('/')) {
    return new Response('Missing or invalid redirect', { status: 400 })
  }

  const isTask = type === 'task' && targetId
  if (!lessonId && !isTask) {
    return new Response('Missing lessonId or type=task&targetId', { status: 400 })
  }
  if (lessonId && isTask) {
    return new Response('Use either lessonId or type=task&targetId', { status: 400 })
  }

  const supabase = getSupabaseServer(locals, request, cookies)
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (user) {
    const repo = createSupabaseProgressRepository(supabase)
    if (lessonId) {
      await repo.addCompletedItem(user.id, 'lesson', lessonId)
    } else if (isTask && targetId) {
      await repo.addCompletedItem(user.id, 'task', targetId)
    }
  }

  return redirect(redirectTo)
}
