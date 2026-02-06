/**
 * Port for progress persistence (hexagonal architecture).
 */
export interface ProgressRepository {
  getCompletedLessons(userId: string): Promise<Set<string>>
  addCompletedLesson(userId: string, lessonId: string): Promise<void>
}
