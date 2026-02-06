import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProgressRepository } from './port'

export function createSupabaseProgressRepository(supabase: SupabaseClient): ProgressRepository {
  return {
    async getCompletedLessons(userId: string): Promise<Set<string>> {
      const { data, error } = await supabase
        .from('progress')
        .select('completed_lessons')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        console.error('Failed to get user progress:', error)
        return new Set<string>()
      }

      const list: string[] = data?.completed_lessons ?? []
      return new Set(list)
    },

    async addCompletedLesson(userId: string, lessonId: string): Promise<void> {
      const { data: existing, error: fetchError } = await supabase
        .from('progress')
        .select('completed_lessons')
        .eq('user_id', userId)
        .maybeSingle()

      if (fetchError) {
        console.error('Failed to fetch user progress:', fetchError)
        return
      }

      const currentLessons: string[] = existing?.completed_lessons ?? []
      if (currentLessons.includes(lessonId)) {
        return
      }

      const updatedLessons = [...currentLessons, lessonId]
      const { error: upsertError } = await supabase.from('progress').upsert(
        {
          user_id: userId,
          completed_lessons: updatedLessons,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      )

      if (upsertError) {
        console.error('Failed to mark lesson as completed:', upsertError)
      }
    }
  }
}
