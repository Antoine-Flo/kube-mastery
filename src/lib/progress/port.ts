/**
 * Port for progress persistence (hexagonal architecture).
 */
export type CompletionType = 'lesson' | 'task'

export interface ProgressRepository {
  getCompletedLessons(userId: string): Promise<Set<string>>
  getCompletedItemIds(userId: string, type: CompletionType): Promise<Set<string>>
  addCompletedItem(userId: string, type: CompletionType, targetId: string): Promise<void>
}
