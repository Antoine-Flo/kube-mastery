import type { APIRoute } from 'astro'
import { getSupabaseServer } from '../../../lib/supabase'
import { createSupabaseProgressRepository } from '../../../lib/progress/server'

/**
 * GET /api/progress/complete?lessonId=xxx&redirect=/en/courses/...
 * Marks the lesson completed for the current user, then redirects.
 * If not authenticated, redirects without marking.
 */
export const GET: APIRoute = async ({ url, request, cookies, redirect, locals }) => {
  const lessonId = url.searchParams.get('lessonId')
  const redirectTo = url.searchParams.get('redirect')
  if (!lessonId || !redirectTo) {
    return new Response('Missing lessonId or redirect', { status: 400 })
  }
  if (!redirectTo.startsWith('/')) {
    return new Response('Invalid redirect', { status: 400 })
  }

  const supabase = getSupabaseServer(locals, request, cookies)
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) {
    return redirect(redirectTo)
  }
  const repo = createSupabaseProgressRepository(supabase)
  await repo.addCompletedLesson(user.id, lessonId)
  return redirect(redirectTo)
}
