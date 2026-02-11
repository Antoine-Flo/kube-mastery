/**
 * Server-side progress context: session + completed lessons for the current request.
 */

import { getSupabaseServer } from '../supabase'
import type { ProgressContext } from './types'
import { createSupabaseProgressRepository } from './supabase-adapter'

type AstroCookies = {
  set: (name: string, value: string, options?: { path?: string }) => void
}

export type { ProgressContext }

export async function getProgressContext(
  locals: unknown,
  request: Request,
  cookies: AstroCookies
): Promise<ProgressContext> {
  const supabase = getSupabaseServer(locals, request, cookies)
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) {
    return { completed: new Set<string>() }
  }
  const repo = createSupabaseProgressRepository(supabase)
  const completed = await repo.getCompletedLessons(user.id)
  return { completed, userId: user.id }
}

export async function getCompletedTaskIds(
  locals: unknown,
  request: Request,
  cookies: AstroCookies
): Promise<Set<string>> {
  const supabase = getSupabaseServer(locals, request, cookies)
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) {
    return new Set<string>()
  }
  const repo = createSupabaseProgressRepository(supabase)
  return repo.getCompletedItemIds(user.id, 'task')
}

export { createSupabaseProgressRepository } from './supabase-adapter'
