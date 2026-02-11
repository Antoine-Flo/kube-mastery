import type { SupabaseClient } from '@supabase/supabase-js'
import type { CompletionType, ProgressRepository } from './port'

const COMPLETION_TYPE_LESSON = 'lesson'

export function createSupabaseProgressRepository(supabase: SupabaseClient): ProgressRepository {
  return {
    async getCompletedLessons(userId: string): Promise<Set<string>> {
      const { data, error } = await supabase
        .from('completions')
        .select('target_id')
        .eq('user_id', userId)
        .eq('type', COMPLETION_TYPE_LESSON)

      if (error) {
        console.error('Failed to get user completions:', error)
        return new Set<string>()
      }

      const list = (data ?? []).map((row) => row.target_id)
      return new Set(list)
    },

    async getCompletedItemIds(
      userId: string,
      type: CompletionType
    ): Promise<Set<string>> {
      const { data, error } = await supabase
        .from('completions')
        .select('target_id')
        .eq('user_id', userId)
        .eq('type', type)

      if (error) {
        console.error('Failed to get completed items:', error)
        return new Set<string>()
      }

      return new Set((data ?? []).map((row) => row.target_id))
    },

    async addCompletedItem(
      userId: string,
      type: CompletionType,
      targetId: string
    ): Promise<void> {
      const { error: upsertError } = await supabase.from('completions').upsert(
        {
          user_id: userId,
          type,
          target_id: targetId
        },
        { onConflict: 'user_id,type,target_id' }
      )

      if (upsertError) {
        console.error('Failed to mark item as completed:', upsertError)
      }
    }
  }
}
